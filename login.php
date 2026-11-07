<?php
declare(strict_types=1);

session_start();

function redirectToLogin(string $error): never
{
    header('Location: login.html?error=' . rawurlencode($error), true, 303);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirectToLogin('request');
}

$email = $_POST['email'] ?? null;
$password = $_POST['password'] ?? null;

if (
    !is_string($email)
    || !is_string($password)
    || !filter_var(trim($email), FILTER_VALIDATE_EMAIL)
    || $password === ''
) {
    redirectToLogin('request');
}

try {
    require_once __DIR__ . '/config/db.php';

    $statement = $conn->prepare(
        'SELECT id, nome, email, password_hash, perfil
         FROM utilizadores
         WHERE email = ?
         LIMIT 1'
    );
    $email = trim($email);
    $statement->bind_param('s', $email);
    $statement->execute();
    $user = $statement->get_result()->fetch_assoc();
    $statement->close();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        redirectToLogin('invalid');
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (string) $user['id'];
    $_SESSION['user_name'] = (string) $user['nome'];
    $_SESSION['user_email'] = (string) $user['email'];
    $_SESSION['user_role'] = (string) $user['perfil'];

    header('Location: index.php');
    exit();
} catch (mysqli_sql_exception $exception) {
    error_log('Falha no login MySQL: ' . $exception->getMessage());
    redirectToLogin('unavailable');
}
