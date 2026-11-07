<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function respond(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!isset($_SESSION['user_id'], $_SESSION['user_role'])) {
    respond(401, ['error' => 'unauthenticated']);
}

if (strtolower((string) $_SESSION['user_role']) !== 'administrador') {
    respond(403, ['error' => 'forbidden']);
}

$method = $_SERVER['REQUEST_METHOD'];
$roles = [
    'Operador' => 'operador',
    'Supervisor' => 'supervisor',
    'Administrador' => 'administrador',
];

if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (
        !is_string($csrfToken)
        || !isset($_SESSION['csrf_token'])
        || !hash_equals((string) $_SESSION['csrf_token'], $csrfToken)
    ) {
        respond(403, ['error' => 'csrf']);
    }
}

if ($method === 'POST' || $method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        respond(400, ['error' => 'invalid_request']);
    }

    $email = $input['email'] ?? null;
    $name = $input['name'] ?? null;
    $password = $input['password'] ?? '';
    $role = $input['role'] ?? null;
    $userId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

    if (
        !is_string($email)
        || !is_string($name)
        || !is_string($password)
        || !is_string($role)
        || !filter_var(trim($email), FILTER_VALIDATE_EMAIL)
        || mb_strlen(trim($email), 'UTF-8') > 100
        || trim($name) === ''
        || mb_strlen(trim($name), 'UTF-8') > 100
        || ($method === 'POST' && strlen($password) < 6)
        || ($password !== '' && strlen($password) < 6)
        || !isset($roles[$role])
        || ($method === 'PUT' && $userId === false)
    ) {
        respond(400, ['error' => 'invalid_request']);
    }

    try {
        require_once __DIR__ . '/config/db.php';

        $email = trim($email);
        $name = trim($name);
        $databaseRole = $roles[$role];
        if ($method === 'POST') {
            $passwordHash = password_hash($password, PASSWORD_DEFAULT);
            $statement = $conn->prepare(
                'INSERT INTO utilizadores (nome, email, password_hash, perfil)
                 VALUES (?, ?, ?, ?)'
            );
            $statement->bind_param('ssss', $name, $email, $passwordHash, $databaseRole);
            $statement->execute();
            $userId = $conn->insert_id;
            $status = 201;
        } else {
            if ($password === '') {
                $statement = $conn->prepare(
                    'UPDATE utilizadores SET nome = ?, email = ?, perfil = ? WHERE id = ?'
                );
                $statement->bind_param('sssi', $name, $email, $databaseRole, $userId);
            } else {
                $passwordHash = password_hash($password, PASSWORD_DEFAULT);
                $statement = $conn->prepare(
                    'UPDATE utilizadores
                     SET nome = ?, email = ?, perfil = ?, password_hash = ?
                     WHERE id = ?'
                );
                $statement->bind_param('ssssi', $name, $email, $databaseRole, $passwordHash, $userId);
            }
            $statement->execute();
            $check = $conn->prepare('SELECT id FROM utilizadores WHERE id = ?');
            $check->bind_param('i', $userId);
            $check->execute();
            if (!$check->get_result()->fetch_assoc()) {
                respond(404, ['error' => 'not_found']);
            }
            $status = 200;
        }

        respond($status, [
            'user' => [
                'id' => (string) $userId,
                'email' => $email,
                'name' => $name,
                'role' => $role,
            ],
        ]);
    } catch (mysqli_sql_exception $exception) {
        if ((int) $exception->getCode() === 1062) {
            respond(409, ['error' => 'email_exists']);
        }

        error_log('Falha ao guardar utilizador MySQL: ' . $exception->getMessage());
        respond(500, ['error' => 'database_error']);
    }
}

if ($method === 'DELETE') {
    $userId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($userId === false) {
        respond(400, ['error' => 'invalid_request']);
    }
    if ((string) $userId === (string) $_SESSION['user_id']) {
        respond(400, ['error' => 'cannot_delete_self']);
    }

    try {
        require_once __DIR__ . '/config/db.php';
        $statement = $conn->prepare('DELETE FROM utilizadores WHERE id = ?');
        $statement->bind_param('i', $userId);
        $statement->execute();
        if ($statement->affected_rows === 0) {
            respond(404, ['error' => 'not_found']);
        }
        respond(200, ['deleted' => true]);
    } catch (mysqli_sql_exception $exception) {
        error_log('Falha ao remover utilizador MySQL: ' . $exception->getMessage());
        respond(500, ['error' => 'database_error']);
    }
}

if ($method !== 'GET') {
    header('Allow: GET, POST, PUT, DELETE');
    respond(405, ['error' => 'method_not_allowed']);
}

try {
    require_once __DIR__ . '/config/db.php';
    $result = $conn->query(
        'SELECT id, nome, email, perfil
         FROM utilizadores
         ORDER BY nome, id'
    );
    $users = [];

    while ($user = $result->fetch_assoc()) {
        $roles = [
            'operador' => 'Operador',
            'supervisor' => 'Supervisor',
            'administrador' => 'Administrador',
        ];
        $users[] = [
            'id' => (string) $user['id'],
            'email' => (string) $user['email'],
            'name' => (string) $user['nome'],
            'role' => $roles[strtolower((string) $user['perfil'])] ?? (string) $user['perfil'],
        ];
    }

    echo json_encode(['users' => $users], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (mysqli_sql_exception $exception) {
    error_log('Falha ao consultar utilizadores MySQL: ' . $exception->getMessage());
    respond(500, ['error' => 'database_error']);
}
