// Synthetic users and fictional products seeded for the browser suite. None of
// these names refer to real staff or real medicines.

export const MANAGER = {
  pfno: "9001",
  password: "e2e-manager-pass",
  firstName: "Testa",
  lastName: "Manager",
};

export const PHARMACIST = {
  pfno: "9002",
  password: "e2e-pharmacist-pass",
  firstName: "Testo",
  lastName: "Pharmacist",
};

export const SUPPLIER = "Fictional Supply Co.";

// Sold in the sale test. Two batches so FEFO order can be checked: the batch
// expiring sooner must be drained first.
export const SALE_DRUG = {
  name: "Zentorix 10mg",
  price: 400, // cents
  soonBatch: { batchNo: "E2E-ZEN-SOON", qty: 10, days: 60 },
  lateBatch: { batchNo: "E2E-ZEN-LATE", qty: 40, days: 300 },
};

// Receives new stock in the receive test.
export const RECEIVE_DRUG = {
  name: "Quellamine Syrup",
  price: 1250,
  batch: { batchNo: "E2E-QUE-1", qty: 20, days: 200 },
};

// One batch the manager deletes in the delete test.
export const DELETE_DRUG = {
  name: "Brivolax 5mg",
  price: 300,
  batch: { batchNo: "E2E-BRI-1", qty: 8, days: 150 },
};
