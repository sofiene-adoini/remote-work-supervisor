let sessionState = {
  status: 'clocked_out',
  employeeId: null,
  isAuthenticated: false,
};

function setSessionState(updates) {
  sessionState = {
    ...sessionState,
    ...updates,
  };
}

function getSessionState() {
  return { ...sessionState };
}

function resetSessionState() {
  sessionState = {
    status: 'clocked_out',
    employeeId: null,
    isAuthenticated: false,
  };
}

module.exports = {
  setSessionState,
  getSessionState,
  resetSessionState,
};