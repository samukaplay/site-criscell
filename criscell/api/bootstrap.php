<?php
/**
 * CrisCell — inicialização da API.
 * - conecta no MySQL do XAMPP
 * - cria o banco, as tabelas e os dados iniciais automaticamente (1ª execução)
 * - inicia a sessão e define helpers de resposta/autenticação
 */
$config = require __DIR__ . '/config.php';

date_default_timezone_set('America/Sao_Paulo');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

session_name('criscell_sid');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
session_start();

function json_out($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail($message, $code = 400) {
    json_out(['error' => $message], $code);
}

function input() {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function db() {
    static $pdo = null;
    global $config;
    if ($pdo) return $pdo;

    try {
        $pdo = new PDO(
            "mysql:host={$config['db_host']};port={$config['db_port']};charset=utf8mb4",
            $config['db_user'],
            $config['db_pass'],
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
        $dbName = preg_replace('/[^A-Za-z0-9_]/', '', $config['db_name']);
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$dbName`");
        $pdo->exec("SET time_zone = '-03:00'");
        install_if_needed($pdo, $config);
    } catch (PDOException $e) {
        fail('Banco de dados indisponível. Verifique se o MySQL está ligado no painel do XAMPP.', 500);
    }
    return $pdo;
}

function install_if_needed(PDO $pdo, array $config) {
    $exists = $pdo->query("SHOW TABLES LIKE 'order_items'")->fetch();
    if ($exists) return;

    // 1) Estrutura (database/schema.sql)
    $sql = file_get_contents(__DIR__ . '/../database/schema.sql');
    $sql = preg_replace('/^--.*$/m', '', $sql);
    foreach (explode(';', $sql) as $statement) {
        $statement = trim($statement);
        if ($statement === '' || stripos($statement, 'CREATE DATABASE') === 0 || stripos($statement, 'USE ') === 0) continue;
        $pdo->exec($statement);
    }

    // 2) Dados iniciais (api/seed.json) — só quando a tabela está vazia
    $seed = json_decode(file_get_contents(__DIR__ . '/seed.json'), true);

    if ((int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn() === 0) {
        $st = $pdo->prepare('INSERT INTO products (category,name,description,price,image,badge,badge_class) VALUES (?,?,?,?,?,?,?)');
        foreach ($seed['products'] as $p) {
            $st->execute([$p['category'], $p['name'], $p['description'], $p['price'], $p['image'], $p['badge'], $p['badge_class']]);
        }
    }

    if ((int)$pdo->query('SELECT COUNT(*) FROM services')->fetchColumn() === 0) {
        $st = $pdo->prepare('INSERT INTO services (name,title,description,price,image,whatsapp_text,sort_order) VALUES (?,?,?,?,?,?,?)');
        foreach ($seed['services'] as $s) {
            $st->execute([$s['name'], $s['title'], $s['description'], $s['price'], $s['image'], $s['whatsapp_text'], $s['sort_order']]);
        }
    }

    // 3) Conta de administrador
    if ((int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='admin'")->fetchColumn() === 0) {
        $st = $pdo->prepare("INSERT INTO users (name,email,phone,password_hash,role) VALUES (?,?,?,?, 'admin')");
        $st->execute([
            $config['admin_name'],
            strtolower($config['admin_email']),
            '',
            password_hash($config['admin_password'], PASSWORD_DEFAULT),
        ]);
    }
}

function map_user($r) {
    return [
        'id'        => (int)$r['id'],
        'name'      => $r['name'],
        'email'     => $r['email'],
        'phone'     => $r['phone'],
        'role'      => $r['role'],
        'createdAt' => $r['created_at'],
    ];
}

function current_user() {
    if (empty($_SESSION['uid'])) return null;
    $st = db()->prepare('SELECT id,name,email,phone,role,created_at FROM users WHERE id=?');
    $st->execute([$_SESSION['uid']]);
    $row = $st->fetch();
    if (!$row) { unset($_SESSION['uid']); return null; }
    return $row;
}

function require_login() {
    $u = current_user();
    if (!$u) fail('Faça login para continuar.', 401);
    return $u;
}

function require_admin() {
    $u = require_login();
    if ($u['role'] !== 'admin') fail('Acesso restrito ao administrador.', 403);
    return $u;
}
