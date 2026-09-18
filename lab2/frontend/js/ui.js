const messageElement = document.getElementById('message');

export function showMessage(text, type = 'success') {
  messageElement.textContent = text;
  messageElement.className = `message ${type}`;
}

export function hideMessage() {
  messageElement.textContent = '';
  messageElement.className = 'message hidden';
}