// Status em inglês na API; a tradução acontece só na UI.
const SERVICE_STATUS = Object.freeze({
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
});

const APPLICATION_STATUS = Object.freeze({
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected'
});

const PAYMENT_STATUS = Object.freeze({
  COMPLETED: 'Completed'
});

module.exports = { SERVICE_STATUS, APPLICATION_STATUS, PAYMENT_STATUS };
