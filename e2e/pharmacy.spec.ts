import { test, expect, type Page } from "@playwright/test";
import { e2ePrisma } from "./db";
import {
  MANAGER,
  PHARMACIST,
  SUPPLIER,
  SALE_DRUG,
  RECEIVE_DRUG,
  DELETE_DRUG,
} from "./fixtures";

const prisma = e2ePrisma();
test.afterAll(() => prisma.$disconnect());

async function login(page: Page, user: { pfno: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Staff number (pfno)").fill(user.pfno);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

type CapturedAction = { headers: Record<string, string>; body: Buffer };

/**
 * Runs `trigger` as the signed-in user and captures the Server Action POST it
 * sends to `path`, aborting it in the browser so nothing is written. Replaying
 * the capture with another session tests the server-side check directly;
 * hidden buttons prove nothing on their own.
 */
async function captureServerAction(page: Page, path: string, trigger: () => Promise<void>): Promise<CapturedAction> {
  let captured: CapturedAction | undefined;
  await page.route(`**${path}`, async (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
    const all = await req.allHeaders();
    const keep = ["next-action", "next-router-state-tree", "content-type", "accept", "origin"];
    captured = {
      headers: Object.fromEntries(keep.filter((h) => all[h]).map((h) => [h, all[h]])),
      body: req.postDataBuffer()!,
    };
    await route.abort();
  });
  await trigger();
  await expect.poll(() => captured).toBeDefined();
  await page.unrouteAll();
  return captured!;
}

async function availableOf(drugName: string) {
  const batches = await prisma.stock.findMany({
    where: { drug: { name: drugName }, expiryDate: { gt: new Date() } },
  });
  return batches.reduce((sum, b) => sum + b.remaining, 0);
}

test.describe("authentication", () => {
  test("unauthenticated visitors are sent to the login page", async ({ page }) => {
    await page.goto("/pos");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a wrong password is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Staff number (pfno)").fill(PHARMACIST.pfno);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid staff number or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("signing out revokes the session", async ({ page }) => {
    const before = await prisma.user.findUniqueOrThrow({ where: { pfno: PHARMACIST.pfno } });
    await login(page, PHARMACIST);
    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    const after = await prisma.user.findUniqueOrThrow({ where: { pfno: PHARMACIST.pfno } });
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);
  });
});

test.describe("point of sale", () => {
  test("a pharmacist sells an item and stock decreases first-expiry-first", async ({
    page,
    request, // separate API context with no session cookie
  }) => {
    const SELL = 15; // more than the soon-expiring batch holds, so FEFO spills over
    const startQty = SALE_DRUG.soonBatch.qty + SALE_DRUG.lateBatch.qty;
    expect(await availableOf(SALE_DRUG.name)).toBe(startQty);

    await login(page, PHARMACIST);
    await page.goto("/pos");
    const drugRow = page.getByRole("button", { name: new RegExp(SALE_DRUG.name) });
    await expect(drugRow).toContainText(`${startQty} pcs`);

    await drugRow.click();
    await page.getByLabel(`Quantity of ${SALE_DRUG.name}`).fill(String(SELL));
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Amount paid").fill("100");
    await page.getByRole("button", { name: "Complete sale" }).click();

    // Receipt shows the line and a serial we can look up directly.
    await expect(page.getByText(`${SALE_DRUG.name} × ${SELL}`)).toBeVisible();
    const serialText = await page.getByText(/^No: R-/).textContent();
    const serial = serialText!.replace("No: ", "").trim();

    // Fresh page load reflects the new stock level.
    await page.reload();
    await expect(
      page.getByRole("button", { name: new RegExp(SALE_DRUG.name) }),
    ).toContainText(`${startQty - SELL} pcs`);

    // Database: sale persisted with server-side prices, sold by the pharmacist.
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { serial },
      include: { items: true, soldBy: true },
    });
    expect(sale.soldBy?.pfno).toBe(PHARMACIST.pfno);
    expect(sale.total).toBe(SALE_DRUG.price * SELL);
    expect(sale.paid).toBe(10_000);
    expect(sale.balance).toBe(10_000 - SALE_DRUG.price * SELL);
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]).toMatchObject({ drugName: SALE_DRUG.name, quantity: SELL });

    // Database: soon-expiring batch drained first, remainder from the later one.
    const batches = await prisma.stock.findMany({ where: { drug: { name: SALE_DRUG.name } } });
    const byNo = Object.fromEntries(batches.map((b) => [b.batchNo, b.remaining]));
    expect(byNo[SALE_DRUG.soonBatch.batchNo]).toBe(0);
    expect(byNo[SALE_DRUG.lateBatch.batchNo]).toBe(startQty - SELL);
    expect(await availableOf(SALE_DRUG.name)).toBe(startQty - SELL);

    // The PDF receipt is served to a signed-in user and refused to anyone else.
    const pdf = await page.request.get(`/api/receipt/${sale.id}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    const denied = await request.get(`/api/receipt/${sale.id}`);
    expect(denied.status()).toBe(401);
  });

  test("selling more than is available is blocked and nothing is written", async ({
    page,
  }) => {
    const available = await availableOf(SALE_DRUG.name);
    const salesBefore = await prisma.sale.count();

    await login(page, PHARMACIST);
    await page.goto("/pos");
    await page.getByRole("button", { name: new RegExp(SALE_DRUG.name) }).click();
    await page.getByLabel(`Quantity of ${SALE_DRUG.name}`).fill(String(available + 1));
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      page.getByText(`Only ${available} pcs of ${SALE_DRUG.name} available.`),
    ).toBeVisible();

    expect(await prisma.sale.count()).toBe(salesBefore);
    expect(await availableOf(SALE_DRUG.name)).toBe(available);
  });

  test("the server rejects a sale when stock ran out after it was added to the cart", async ({
    page,
  }) => {
    // The test above only reaches the client-side check. Here the cart is valid
    // when built, then another till takes one unit, so only the server-side
    // check in completeSale/decrementStockFEFO can stop the sale.
    const available = await availableOf(SALE_DRUG.name);
    const salesBefore = await prisma.sale.count();
    const late = { batchNo: SALE_DRUG.lateBatch.batchNo };

    await login(page, PHARMACIST);
    await page.goto("/pos");
    await page.getByRole("button", { name: new RegExp(SALE_DRUG.name) }).click();
    await page.getByLabel(`Quantity of ${SALE_DRUG.name}`).fill(String(available));
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Amount paid").fill("1000");

    await prisma.stock.updateMany({ where: late, data: { remaining: { decrement: 1 } } });
    try {
      await page.getByRole("button", { name: "Complete sale" }).click();
      await expect(
        page.getByText("Not enough stock for one or more items. Refresh and try again."),
      ).toBeVisible();

      await page.reload();
      await expect(
        page.getByRole("button", { name: new RegExp(SALE_DRUG.name) }),
      ).toContainText(`${available - 1} pcs`);
      expect(await prisma.sale.count()).toBe(salesBefore);
      expect(await availableOf(SALE_DRUG.name)).toBe(available - 1);
    } finally {
      await prisma.stock.updateMany({ where: late, data: { remaining: { increment: 1 } } });
    }
  });
});

test.describe("stock", () => {
  test("a manager receives a new batch and the drug price follows it", async ({ page }) => {
    const batchNo = "E2E-QUE-RCV";
    const expiry = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);

    await login(page, MANAGER);
    await page.goto("/stock");
    await page.getByRole("button", { name: "+ Receive stock" }).click();
    await page.getByLabel("Drug").selectOption({ label: RECEIVE_DRUG.name });
    await page.getByLabel("Supplier").selectOption({ label: SUPPLIER });
    await page.getByLabel("Quantity").fill("60");
    await page.getByLabel("Batch no.").fill(batchNo);
    await page.getByLabel("Buying price").fill("9.00");
    await page.getByLabel("Selling price").fill("13.75");
    await page.getByLabel("Expiry date").fill(expiry);
    await page.getByRole("button", { name: "Receive stock", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Receive stock" })).toBeHidden();

    // Fresh page load shows the batch.
    await page.reload();
    const row = page.getByRole("row", { name: new RegExp(batchNo) });
    await expect(row).toContainText(RECEIVE_DRUG.name);
    await expect(row).toContainText("60 / 60");

    // Database: batch stored in cents, attributed to the manager, price updated.
    const batch = await prisma.stock.findFirstOrThrow({
      where: { batchNo },
      include: { drug: true, supplier: true, createdBy: true },
    });
    expect(batch).toMatchObject({
      quantity: 60,
      remaining: 60,
      buyingPrice: 900,
      sellingPrice: 1375,
    });
    expect(batch.drug.name).toBe(RECEIVE_DRUG.name);
    expect(batch.drug.price).toBe(1375);
    expect(batch.supplier.name).toBe(SUPPLIER);
    expect(batch.createdBy?.pfno).toBe(MANAGER.pfno);
    expect(batch.expiryDate.toISOString().slice(0, 10)).toBe(expiry);
    expect(await availableOf(RECEIVE_DRUG.name)).toBe(RECEIVE_DRUG.batch.qty + 60);
  });

  test("a manager deletes a batch", async ({ page }) => {
    const { batchNo } = DELETE_DRUG.batch;
    expect(await prisma.stock.count({ where: { batchNo } })).toBe(1);

    await login(page, MANAGER);
    await page.goto("/stock");
    const row = page.getByRole("row", { name: new RegExp(batchNo) });
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(row).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(batchNo) })).toHaveCount(0);
    expect(await prisma.stock.count({ where: { batchNo } })).toBe(0);
  });
});

test.describe("role permissions", () => {
  test("a pharmacist is denied manager-only sections and stock deletion", async ({
    page,
  }) => {
    const usersBefore = await prisma.user.count();
    const batchesBefore = await prisma.stock.count();

    await login(page, PHARMACIST);
    await expect(page.getByRole("link", { name: /Staff/ })).toHaveCount(0);

    for (const path of ["/staff", "/suppliers"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard\?denied=1$/);
      await expect(page.getByText("That section is restricted to managers.")).toBeVisible();
    }

    // Pharmacists can see stock but get no delete control.
    await page.goto("/stock");
    await expect(page.getByRole("row", { name: new RegExp(SALE_DRUG.lateBatch.batchNo) })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

    expect(await prisma.user.count()).toBe(usersBefore);
    expect(await prisma.stock.count()).toBe(batchesBefore);
  });

  test("a pharmacist calling the delete Server Action directly is refused by the server", async ({
    page,
    browser,
    baseURL,
  }) => {
    // Hiding the Delete button proves nothing on its own: Server Actions are
    // reachable by direct POST. Capture the exact request a manager's Delete
    // sends (stopped in the browser, so nothing is deleted), then replay it
    // with a pharmacist's session.
    const { batchNo } = DELETE_DRUG.guardBatch;
    const where = { batchNo };
    expect(await prisma.stock.count({ where })).toBe(1);

    await login(page, MANAGER);
    await page.goto("/stock");
    let captured: { headers: Record<string, string>; body: Buffer } | undefined;
    await page.route("**/stock", async (route) => {
      const req = route.request();
      if (req.method() !== "POST" || !req.headers()["next-action"]) return route.continue();
      const all = await req.allHeaders();
      const keep = ["next-action", "next-router-state-tree", "content-type", "accept", "origin"];
      captured = {
        headers: Object.fromEntries(keep.filter((h) => all[h]).map((h) => [h, all[h]])),
        body: req.postDataBuffer()!,
      };
      await route.abort();
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("row", { name: new RegExp(batchNo) }).getByRole("button", { name: "Delete" }).click();
    await expect.poll(() => captured).toBeDefined();
    await page.unrouteAll();
    expect(await prisma.stock.count({ where })).toBe(1);

    const pharmacist = await browser.newContext({ baseURL });
    try {
      await login(await pharmacist.newPage(), PHARMACIST);
      await pharmacist.request.post("/stock", { headers: captured!.headers, data: captured!.body });
    } finally {
      await pharmacist.close();
    }
    expect(await prisma.stock.count({ where })).toBe(1);

    // Control: the same request with the manager's session does delete, so the
    // replay really reaches deleteStock and the check above is not vacuous.
    await page.request.post("/stock", { headers: captured!.headers, data: captured!.body });
    expect(await prisma.stock.count({ where })).toBe(0);
  });
  test("a pharmacist sees drugs and stock read-only: no add, edit or receive controls", async ({ page }) => {
    await login(page, PHARMACIST);
    await page.goto("/drugs");
    await expect(page.getByRole("row", { name: new RegExp(SALE_DRUG.name) })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add drug" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await page.goto("/stock");
    await expect(page.getByRole("row", { name: new RegExp(SALE_DRUG.lateBatch.batchNo) })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Receive stock" })).toHaveCount(0);
  });

  test("a pharmacist calling the add-drug Server Action directly is refused by the server", async ({ page, browser, baseURL }) => {
    const name = "Capturol 20mg";
    await login(page, MANAGER);
    await page.goto("/drugs");
    const captured = await captureServerAction(page, "/drugs", async () => {
      await page.getByRole("button", { name: "+ Add drug" }).click();
      await page.getByLabel("Drug name").fill(name);
      await page.getByLabel("Unit (e.g. pcs, ml, mg)").fill("pcs");
      await page.getByLabel("Selling price").fill("7.50");
      await page.getByRole("button", { name: "Add drug", exact: true }).click();
    });
    expect(await prisma.drug.count({ where: { name } })).toBe(0);

    const pharmacist = await browser.newContext({ baseURL });
    try {
      await login(await pharmacist.newPage(), PHARMACIST);
      await pharmacist.request.post("/drugs", { headers: captured.headers, data: captured.body });
    } finally {
      await pharmacist.close();
    }
    expect(await prisma.drug.count({ where: { name } })).toBe(0);

    // Control: the manager's replay creates the drug, so the replay reaches createDrug.
    await page.request.post("/drugs", { headers: captured.headers, data: captured.body });
    expect(await prisma.drug.count({ where: { name } })).toBe(1);
  });

  test("a pharmacist calling the edit-drug Server Action directly cannot change a price", async ({ page, browser, baseURL }) => {
    const where = { name: RECEIVE_DRUG.name };
    const before = (await prisma.drug.findFirstOrThrow({ where })).price;
    await login(page, MANAGER);
    await page.goto("/drugs");
    const captured = await captureServerAction(page, "/drugs", async () => {
      await page.getByRole("row", { name: new RegExp(RECEIVE_DRUG.name) }).getByRole("button", { name: "Edit" }).click();
      await page.getByLabel("Selling price").fill("99.99");
      await page.getByRole("button", { name: "Save changes" }).click();
    });
    expect((await prisma.drug.findFirstOrThrow({ where })).price).toBe(before);

    const pharmacist = await browser.newContext({ baseURL });
    try {
      await login(await pharmacist.newPage(), PHARMACIST);
      await pharmacist.request.post("/drugs", { headers: captured.headers, data: captured.body });
    } finally {
      await pharmacist.close();
    }
    expect((await prisma.drug.findFirstOrThrow({ where })).price).toBe(before);

    // Control: the manager's replay changes the price.
    await page.request.post("/drugs", { headers: captured.headers, data: captured.body });
    expect((await prisma.drug.findFirstOrThrow({ where })).price).toBe(9999);
  });

  test("a pharmacist calling the receive-stock Server Action directly is refused by the server", async ({ page, browser, baseURL }) => {
    const batchNo = "E2E-CAPTURED-RCV";
    const expiry = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
    await login(page, MANAGER);
    await page.goto("/stock");
    const captured = await captureServerAction(page, "/stock", async () => {
      await page.getByRole("button", { name: "+ Receive stock" }).click();
      await page.getByLabel("Drug").selectOption({ label: SALE_DRUG.name });
      await page.getByLabel("Supplier").selectOption({ label: SUPPLIER });
      await page.getByLabel("Quantity").fill("5");
      await page.getByLabel("Batch no.").fill(batchNo);
      await page.getByLabel("Buying price").fill("1.00");
      await page.getByLabel("Selling price").fill("2.00");
      await page.getByLabel("Expiry date").fill(expiry);
      await page.getByRole("button", { name: "Receive stock", exact: true }).click();
    });
    expect(await prisma.stock.count({ where: { batchNo } })).toBe(0);

    const pharmacist = await browser.newContext({ baseURL });
    try {
      await login(await pharmacist.newPage(), PHARMACIST);
      await pharmacist.request.post("/stock", { headers: captured.headers, data: captured.body });
    } finally {
      await pharmacist.close();
    }
    expect(await prisma.stock.count({ where: { batchNo } })).toBe(0);

    // Control: the manager's replay receives the batch.
    await page.request.post("/stock", { headers: captured.headers, data: captured.body });
    expect(await prisma.stock.count({ where: { batchNo } })).toBe(1);
  });
});
