import { store } from './store.js';

const loginForm = document.querySelector('#loginForm');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const togglePasswordButton = document.querySelector('#togglePassword');
const rememberSessionInput = document.querySelector('#rememberSession');
const formMessage = document.querySelector('#formMessage');
const submitButton = loginForm.querySelector('button[type="submit"]');

function setFieldError(input, message) {
  const errorElement = document.querySelector(`#${input.id}Error`);
  input.classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', String(Boolean(message)));
  errorElement.textContent = message;
}

function validateForm() {
  let isValid = true;
  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  setFieldError(usernameInput, '');
  setFieldError(passwordInput, '');
  formMessage.textContent = '';
  formMessage.classList.remove('success');

  if (username.length < 3) {
    setFieldError(usernameInput, 'Introduza um identificador com pelo menos 3 caracteres.');
    isValid = false;
  }

  if (password.length < 6) {
    setFieldError(passwordInput, 'A palavra-passe deve conter pelo menos 6 caracteres.');
    isValid = false;
  }

  const user = store.getUsers().find(item =>
    item.username.toLowerCase() === username && item.active && item.password === password
  );
  if (!user) {
    setFieldError(usernameInput, 'Identificador ou palavra-passe inválidos.');
    setFieldError(passwordInput, 'Identificador ou palavra-passe inválidos.');
    formMessage.textContent = 'Não foi possível autorizar o acesso com estas credenciais.';
    isValid = false;
  }

  if (!isValid) {
    formMessage.textContent = formMessage.textContent || 'Preencha corretamente os campos obrigatórios.';
  }

  return isValid;
}

function saveSession() {
  const username = usernameInput.value.trim().toLowerCase();
  const user = store.getUsers().find(item => item.username.toLowerCase() === username && item.active);
  const session = {
    username,
    role: user?.role || null,
    authenticatedAt: new Date().toISOString()
  };

  try {
    const storage = rememberSessionInput.checked ? localStorage : sessionStorage;
    const otherStorage = rememberSessionInput.checked ? sessionStorage : localStorage;
    otherStorage.removeItem('andaLaSession');
    storage.setItem('andaLaSession', JSON.stringify(session));
  } catch (error) {
    console.warn('Não foi possível guardar a sessão:', error);
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!validateForm()) {
    const firstInvalidInput = loginForm.querySelector('[aria-invalid="true"]');
    firstInvalidInput?.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Acesso em curso…';
  formMessage.textContent = '';

  window.setTimeout(() => {
    saveSession();
    formMessage.textContent = 'Acesso autorizado. O cargo será gerido pelo administrador.';
    formMessage.classList.add('success');

    window.setTimeout(() => {
      window.location.href = 'index.html';
    }, 450);
  }, 500);
});

togglePasswordButton.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  togglePasswordButton.textContent = isPassword ? 'Ocultar' : 'Mostrar';
  passwordInput.focus();
});

document.querySelectorAll('.demo-account').forEach((button) => {
  button.addEventListener('click', () => {
    usernameInput.value = button.dataset.username;
    passwordInput.value = button.dataset.password;
    usernameInput.focus();
    formMessage.textContent = `${button.querySelector('.demo-account-role').textContent} preenchido automaticamente.`;
    formMessage.classList.add('success');
  });
});

[usernameInput, passwordInput].forEach((input) => {
  input.addEventListener('input', () => {
    if (input.classList.contains('invalid')) {
      setFieldError(input, '');
    }
  });
});
