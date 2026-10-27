<?php
/**
 * CrisCell — API (front controller).
 * Uso: api/index.php?r=<rota>   ex.: api/index.php?r=products
 */
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$route  = trim((string)($_GET['r'] ?? ''), '/');
$id     = (int)($_GET['id'] ?? 0);

// Proteção CSRF: toda requisição que altera dados precisa do cabeçalho abaixo
// (navegadores não o enviam em formulários de outros sites).
if ($method !== 'GET' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'criscell') {
    fail('Requisição inválida.', 400);
}

/* ---------- helpers de validação e mapeamento ---------- */

function clean($v, $max) {
    $v = trim((string)$v);
    return mb_substr($v, 0, $max);
}

function valid_image($url) {
    return filter_var($url, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $url);
}

function map_product($r) {
    return [
        'id' => (int)$r['id'], 'category' => $r['category'], 'name' => $r['name'],
        'description' => $r['description'], 'price' => (float)$r['price'],
        'image' => $r['image'], 'badge' => $r['badge'], 'badgeClass' => $r['badge_class'],
    ];
}

function map_service($r) {
    return [
        'id' => (int)$r['id'], 'name' => $r['name'], 'title' => $r['title'],
        'description' => $r['description'], 'price' => (float)$r['price'],
        'image' => $r['image'], 'whatsappText' => $r['whatsapp_text'],
    ];
}

function product_input() {
    $in = input();
    $data = [
        'category'    => clean($in['category'] ?? '', 80),
        'name'        => clean($in['name'] ?? '', 160),
        'description' => clean($in['description'] ?? '', 500),
        'price'       => round((float)($in['price'] ?? -1), 2),
        'image'       => clean($in['image'] ?? '', 500),
        'badge'       => clean($in['badge'] ?? '', 40),
    ];
    if ($data['name'] === '' || $data['category'] === '' || $data['description'] === '') fail('Preencha categoria, nome e descrição.');
    if ($data['price'] < 0 || $data['price'] > 99999) fail('Preço inválido.');
    if (!valid_image($data['image'])) fail('Informe uma URL de imagem válida (http/https).');
    return $data;
}

function service_input() {
    $in = input();
    $name = clean($in['name'] ?? '', 120);
    $data = [
        'name'          => $name,
        'title'         => clean($in['title'] ?? '', 160) ?: $name,
        'description'   => clean($in['description'] ?? '', 500),
        'price'         => round((float)($in['price'] ?? -1), 2),
        'image'         => clean($in['image'] ?? '', 500),
        'whatsapp_text' => clean($in['whatsappText'] ?? '', 200) ?: "Quero orçamento para $name",
    ];
    if ($data['name'] === '' || $data['description'] === '') fail('Preencha nome e descrição.');
    if ($data['price'] < 0 || $data['price'] > 99999) fail('Preço inválido.');
    if (!valid_image($data['image'])) fail('Informe uma URL de imagem válida (http/https).');
    return $data;
}

function map_orders(array $rows) {
    if (!$rows) return [];
    $ids = array_map(fn($r) => (int)$r['id'], $rows);
    $in  = implode(',', array_fill(0, count($ids), '?'));
    $st  = db()->prepare("SELECT order_id,kind,item_id,name,unit_price,qty FROM order_items WHERE order_id IN ($in)");
    $st->execute($ids);
    $items = [];
    foreach ($st->fetchAll() as $it) {
        $items[$it['order_id']][] = [
            'kind' => $it['kind'], 'name' => $it['name'],
            'unitPrice' => (float)$it['unit_price'], 'qty' => (int)$it['qty'],
        ];
    }
    return array_map(function ($r) use ($items) {
        $o = [
            'id' => (int)$r['id'], 'title' => $r['title'], 'type' => $r['type'],
            'total' => $r['total'] === null ? null : (float)$r['total'],
            'status' => $r['status'], 'createdAt' => $r['created_at'],
            'items' => $items[$r['id']] ?? [],
        ];
        if (isset($r['customer_name'])) {
            $o['customerName'] = $r['customer_name'];
            $o['customerEmail'] = $r['customer_email'];
        }
        return $o;
    }, $rows);
}

/* ---------- rotas ---------- */

switch ("$method $route") {

    /* ===== Catálogo público ===== */
    case 'GET products':
        $rows = db()->query('SELECT * FROM products ORDER BY id')->fetchAll();
        json_out(['products' => array_map('map_product', $rows)]);

    case 'GET services':
        $rows = db()->query('SELECT * FROM services WHERE active=1 ORDER BY sort_order, id')->fetchAll();
        json_out(['services' => array_map('map_service', $rows)]);

    /* ===== Conta ===== */
    case 'GET auth/me':
        $u = current_user();
        json_out(['user' => $u ? map_user($u) : null]);

    case 'POST auth/register':
        $in    = input();
        $name  = clean($in['name'] ?? '', 120);
        $email = strtolower(clean($in['email'] ?? '', 160));
        $phone = clean($in['phone'] ?? '', 30);
        $pass  = (string)($in['password'] ?? '');
        if ($name === '' || $phone === '') fail('Preencha nome e WhatsApp.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('E-mail inválido.');
        if (strlen($pass) < 6) fail('A senha deve ter pelo menos 6 caracteres.');
        $st = db()->prepare('SELECT id FROM users WHERE email=?');
        $st->execute([$email]);
        if ($st->fetch()) fail('Este e-mail já está cadastrado. Faça login.', 409);
        $st = db()->prepare("INSERT INTO users (name,email,phone,password_hash,role) VALUES (?,?,?,?, 'cliente')");
        $st->execute([$name, $email, $phone, password_hash($pass, PASSWORD_DEFAULT)]);
        session_regenerate_id(true);
        $_SESSION['uid'] = (int)db()->lastInsertId();
        json_out(['user' => map_user(current_user())], 201);

    case 'POST auth/login':
        $in    = input();
        $email = strtolower(clean($in['email'] ?? '', 160));
        $pass  = (string)($in['password'] ?? '');
        $st = db()->prepare('SELECT id,password_hash FROM users WHERE email=?');
        $st->execute([$email]);
        $row = $st->fetch();
        if (!$row || !password_verify($pass, $row['password_hash'])) {
            usleep(400000); // dificulta tentativas em massa
            fail('E-mail ou senha incorretos.', 401);
        }
        session_regenerate_id(true);
        $_SESSION['uid'] = (int)$row['id'];
        json_out(['user' => map_user(current_user())]);

    case 'POST auth/logout':
        $_SESSION = [];
        session_destroy();
        json_out(['ok' => true]);

    case 'POST auth/profile':
        $u = require_login();
        $in = input();
        $name  = clean($in['name'] ?? '', 120);
        $phone = clean($in['phone'] ?? '', 30);
        if ($name === '' || $phone === '') fail('Preencha nome e telefone.');
        $st = db()->prepare('UPDATE users SET name=?, phone=? WHERE id=?');
        $st->execute([$name, $phone, $u['id']]);
        json_out(['user' => map_user(current_user())]);

    /* ===== Pedidos do cliente ===== */
    case 'GET orders':
        $u = require_login();
        $st = db()->prepare('SELECT * FROM orders WHERE user_id=? AND customer_hidden=0 ORDER BY id DESC LIMIT 100');
        $st->execute([$u['id']]);
        json_out(['orders' => map_orders($st->fetchAll())]);

    case 'POST orders':
        // Preços e nomes SEMPRE vêm do banco — o navegador só informa o que e quantos.
        $u     = require_login();
        $in    = input();
        $via   = ($in['via'] ?? 'carrinho') === 'orcamento' ? 'orcamento' : 'carrinho';
        $items = $in['items'] ?? null;
        if (!is_array($items) || !$items || count($items) > 50) fail('Carrinho vazio.');

        $lines = [];
        foreach ($items as $it) {
            $kind = $it['kind'] ?? '';
            $iid  = (int)($it['id'] ?? 0);
            $qty  = max(1, min(99, (int)($it['qty'] ?? 1)));
            if ($kind === 'produto')      $st = db()->prepare('SELECT id,name,price FROM products WHERE id=?');
            elseif ($kind === 'servico')  $st = db()->prepare('SELECT id,name,price FROM services WHERE id=? AND active=1');
            else fail('Item inválido.');
            $st->execute([$iid]);
            $row = $st->fetch();
            if (!$row) fail('Um dos itens não está mais disponível. Atualize a página.', 409);
            $key = $kind . '-' . $iid;
            if (isset($lines[$key])) {
                $lines[$key]['qty'] = min(99, $lines[$key]['qty'] + $qty);
            } else {
                $lines[$key] = ['kind' => $kind, 'id' => $iid, 'name' => $row['name'], 'price' => (float)$row['price'], 'qty' => $qty];
            }
        }
        $lines = array_values($lines);
        $count = array_sum(array_column($lines, 'qty'));
        $total = 0;
        foreach ($lines as $l) $total += $l['price'] * $l['qty'];

        if ($via === 'orcamento') {
            $title = $lines[0]['name'];
            $type  = $lines[0]['kind'];
            $orderTotal = null; // orçamento: valor definido após o diagnóstico
        } else {
            $title = "Pedido do Carrinho ($count " . ($count === 1 ? 'item' : 'itens') . ')';
            $type  = 'carrinho';
            $orderTotal = round($total, 2);
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('INSERT INTO orders (user_id,title,type,total) VALUES (?,?,?,?)');
            $st->execute([$u['id'], $title, $type, $orderTotal]);
            $orderId = (int)$pdo->lastInsertId();
            $st = $pdo->prepare('INSERT INTO order_items (order_id,kind,item_id,name,unit_price,qty) VALUES (?,?,?,?,?,?)');
            foreach ($lines as $l) $st->execute([$orderId, $l['kind'], $l['id'], $l['name'], $l['price'], $l['qty']]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            fail('Não foi possível registrar o pedido.', 500);
        }
        $st = $pdo->prepare('SELECT * FROM orders WHERE id=?');
        $st->execute([$orderId]);
        json_out(['order' => map_orders($st->fetchAll())[0]], 201);

    case 'POST orders/clear':
        // "Limpar histórico" apenas esconde os pedidos do cliente; o admin continua com o registro.
        $u = require_login();
        $st = db()->prepare('UPDATE orders SET customer_hidden=1 WHERE user_id=?');
        $st->execute([$u['id']]);
        json_out(['ok' => true]);

    /* ===== Administração ===== */
    case 'POST admin/products':
        require_admin();
        $d = product_input();
        $st = db()->prepare('INSERT INTO products (category,name,description,price,image,badge) VALUES (?,?,?,?,?,?)');
        $st->execute([$d['category'], $d['name'], $d['description'], $d['price'], $d['image'], $d['badge']]);
        json_out(['id' => (int)db()->lastInsertId()], 201);

    case 'PUT admin/products':
        require_admin();
        if (!$id) fail('Produto não informado.');
        $d = product_input();
        $st = db()->prepare('UPDATE products SET category=?,name=?,description=?,price=?,image=?,badge=? WHERE id=?');
        $st->execute([$d['category'], $d['name'], $d['description'], $d['price'], $d['image'], $d['badge'], $id]);
        json_out(['ok' => true]);

    case 'DELETE admin/products':
        require_admin();
        if (!$id) fail('Produto não informado.');
        db()->prepare('DELETE FROM products WHERE id=?')->execute([$id]);
        json_out(['ok' => true]);

    case 'POST admin/services':
        require_admin();
        $d = service_input();
        $next = (int)db()->query('SELECT COALESCE(MAX(sort_order),0)+1 FROM services')->fetchColumn();
        $st = db()->prepare('INSERT INTO services (name,title,description,price,image,whatsapp_text,sort_order) VALUES (?,?,?,?,?,?,?)');
        $st->execute([$d['name'], $d['title'], $d['description'], $d['price'], $d['image'], $d['whatsapp_text'], $next]);
        json_out(['id' => (int)db()->lastInsertId()], 201);

    case 'PUT admin/services':
        require_admin();
        if (!$id) fail('Serviço não informado.');
        $d = service_input();
        $st = db()->prepare('UPDATE services SET name=?,title=?,description=?,price=?,image=?,whatsapp_text=? WHERE id=?');
        $st->execute([$d['name'], $d['title'], $d['description'], $d['price'], $d['image'], $d['whatsapp_text'], $id]);
        json_out(['ok' => true]);

    case 'DELETE admin/services':
        require_admin();
        if (!$id) fail('Serviço não informado.');
        db()->prepare('DELETE FROM services WHERE id=?')->execute([$id]);
        json_out(['ok' => true]);

    case 'GET admin/orders':
        require_admin();
        $rows = db()->query(
            'SELECT o.*, u.name AS customer_name, u.email AS customer_email
               FROM orders o JOIN users u ON u.id = o.user_id
              ORDER BY o.id DESC LIMIT 300'
        )->fetchAll();
        json_out(['orders' => map_orders($rows)]);

    case 'PATCH admin/orders':
        require_admin();
        $status = input()['status'] ?? '';
        if (!$id || !in_array($status, ['pendente', 'concluido'], true)) fail('Dados inválidos.');
        db()->prepare('UPDATE orders SET status=? WHERE id=?')->execute([$status, $id]);
        json_out(['ok' => true]);

    case 'DELETE admin/orders':
        require_admin();
        if (!$id) fail('Pedido não informado.');
        db()->prepare('DELETE FROM orders WHERE id=?')->execute([$id]);
        json_out(['ok' => true]);

    case 'GET admin/users':
        require_admin();
        // password_hash nunca é selecionado nem enviado.
        $rows = db()->query('SELECT id,name,email,phone,role,created_at FROM users ORDER BY id DESC')->fetchAll();
        json_out(['users' => array_map('map_user', $rows)]);

    default:
        fail('Rota não encontrada.', 404);
}
