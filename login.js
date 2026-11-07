const passwordInput = document.querySelector('#password');
const togglePasswordButton = document.querySelector('#togglePassword');
const formMessage = document.querySelector('#formMessage');

const errorMessages = {
  invalid: 'E-mail ou palavra-passe inválidos.',
  unavailable: 'Não foi possível contactar o serviço de autenticação. Tente novamente mais tarde.',
  request: 'Pedido inválido. Preencha os campos e tente novamente.'
};

const errorCode = new URLSearchParams(window.location.search).get('error');
if (errorCode && formMessage) {
  formMessage.textContent = errorMessages[errorCode] || errorMessages.request;
  window.history.replaceState({}, document.title, window.location.pathname);
}

togglePasswordButton?.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  togglePasswordButton.textContent = isPassword ? 'Ocultar' : 'Mostrar';
  passwordInput.focus();
});
