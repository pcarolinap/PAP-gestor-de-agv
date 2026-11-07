<?php
declare(strict_types=1);

header('Content-Type: text/plain; charset=UTF-8');

try {
    require_once __DIR__ . '/config/db.php';
    $conn->query('SELECT 1');
    echo 'Ligação à base de dados estabelecida com sucesso.';
} catch (mysqli_sql_exception $exception) {
    error_log('Falha no teste da base de dados: ' . $exception->getMessage());
    http_response_code(500);
    exit('Erro ao ligar à base de dados. Confirme se o MySQL está ativo e se a base de dados "andala_pap" existe.');
}
