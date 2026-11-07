<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (
    !isset(
        $_SESSION['user_id'],
        $_SESSION['user_name'],
        $_SESSION['user_email'],
        $_SESSION['user_role']
    )
) {
    http_response_code(401);
    echo json_encode(['authenticated' => false]);
    exit;
}

if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

echo json_encode([
    'authenticated' => true,
    'user' => [
        'id' => (string) $_SESSION['user_id'],
        'name' => (string) $_SESSION['user_name'],
        'email' => (string) $_SESSION['user_email'],
        'role' => (string) $_SESSION['user_role'],
    ],
    'csrfToken' => $_SESSION['csrf_token'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
