<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$host = 'localhost';
$user = 'root';
$pass = '';
$dbname = 'andala_pap';

$conn = new mysqli($host, $user, $pass, $dbname);
$conn->set_charset('utf8mb4');
?>