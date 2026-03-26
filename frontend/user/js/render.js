function renderTransactions(items, container) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<p class="muted">No transactions yet.</p>';
    return;
  }
  container.innerHTML = items
    .map(
      (tx) => `
      <div class="card">
        <div class="tx-row">
          <div>
            <strong>${tx.type.toUpperCase()}</strong>
            <div class="muted">${new Date(tx.created_at).toLocaleString()}</div>
          </div>
          <div>
            <div class="balance">₦${Number(tx.total).toFixed(2)}</div>
            <span class="status-pill">${tx.status}</span>
          </div>
        </div>
        <div class="muted">Ref: ${tx.reference}</div>
      </div>`
    )
    .join('');
}

export { renderTransactions };
