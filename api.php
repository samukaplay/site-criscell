<?php
/* CrisCell — backend (PHP + SQLite). Banco criado automaticamente em criscell.db */
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out($data, $code = 200) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function fail($msg, $code = 200) { out(['sucesso' => false, 'mensagem' => $msg], $code); }

try {
  $db = new PDO('sqlite:' . __DIR__ . '/criscell.db');
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (Throwable $e) {
  fail('Banco de dados indisponível. Verifique se a extensão pdo_sqlite está ativa no PHP.', 500);
}

$db->exec("CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT DEFAULT '',
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'cliente',
  data_cadastro TEXT NOT NULL DEFAULT (datetime('now','localtime'))
)");
$db->exec("CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria TEXT, nome TEXT NOT NULL, descricao TEXT,
  preco REAL NOT NULL DEFAULT 0, imagem TEXT, badge TEXT, estoque INTEGER DEFAULT 1
)");
$db->exec("CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  nome TEXT NOT NULL, tipo TEXT, preco TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  data TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
)");

if ((int)$db->query('SELECT COUNT(*) FROM produtos')->fetchColumn() === 0) {
  $ins = $db->prepare('INSERT INTO produtos (categoria,nome,descricao,preco,imagem,badge) VALUES (?,?,?,?,?,?)');
  foreach ([
    ['Proteção Tela', 'Película de Cerâmica 9D', 'Resistência máxima contra impactos, sem trincar as bordas.', 25.00, 'https://images.pexels.com/photos/719399/pexels-photo-719399.jpeg?auto=compress&cs=tinysrgb&w=600&h=500&fit=crop', 'Mais Vendido'],
    ['Energia', 'Carregador Turbo 20W PD', 'Fonte USB-C de carregamento rápido para iPhone e Android.', 65.00, 'https://images.pexels.com/photos/5208777/pexels-photo-5208777.jpeg?auto=compress&cs=tinysrgb&w=600&h=500&fit=crop', 'Carga Rápida'],
    ['Áudio', 'Fone Bluetooth TWS Pro', 'Som estéreo de alta fidelidade com graves profundos e estojo recarregável.', 110.00, 'https://images.pexels.com/photos/14979021/pexels-photo-14979021.jpeg?auto=compress&cs=tinysrgb&w=600&h=500&fit=crop', ''],
    ['Proteção Corpo', 'Capa Anti-Impacto MagSafe', 'Bordas reforçadas em TPU flexível com alinhamento magnético.', 45.00, 'https://images.pexels.com/photos/18403789/pexels-photo-18403789.jpeg?auto=compress&cs=tinysrgb&w=600&h=500&fit=crop', ''],
  ] as $p) $ins->execute($p);
}

$acao = $_REQUEST['acao'] ?? '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';

// Proteção básica contra CSRF: ações que alteram dados só via POST com o cabeçalho do fetch
$leitura = ['sessao', 'listar_produtos'];
if (!in_array($acao, $leitura, true)) {
  if (!$isPost || ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'fetch') fail('Requisição inválida.', 400);
}

function usuarioLogado(PDO $db) {
  if (empty($_SESSION['uid'])) return null;
  $s = $db->prepare('SELECT id,nome,email,telefone,papel FROM usuarios WHERE id=?');
  $s->execute([$_SESSION['uid']]);
  return $s->fetch() ?: null;
}
function exigeLogin(PDO $db) { $u = usuarioLogado($db); if (!$u) fail('Faça login para continuar.', 401); return $u; }
function exigeAdmin(PDO $db) { $u = exigeLogin($db); if ($u['papel'] !== 'admin') fail('Acesso restrito ao administrador.', 403); return $u; }
function pub($u) { return ['nome' => $u['nome'], 'email' => $u['email'], 'telefone' => $u['telefone'], 'papel' => $u['papel']]; }
function campo($k) { return trim((string)($_POST[$k] ?? '')); }

switch ($acao) {

  case 'sessao':
    $u = usuarioLogado($db);
    out(['usuario' => $u ? pub($u) : null]);

  case 'registrar':
    $nome = campo('nome'); $email = strtolower(campo('email')); $tel = campo('telefone'); $senha = (string)($_POST['senha'] ?? '');
    if ($nome === '' || $email === '' || $tel === '') fail('Preencha todos os campos.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('E-mail inválido.');
    if (strlen($senha) < 4) fail('A senha deve ter pelo menos 4 caracteres.');
    $s = $db->prepare('SELECT 1 FROM usuarios WHERE email=?'); $s->execute([$email]);
    if ($s->fetch()) fail('Este e-mail já está cadastrado. Use a aba "Entrar".');
    $s = $db->prepare("INSERT INTO usuarios (nome,email,telefone,senha_hash,papel) VALUES (?,?,?,?, 'cliente')");
    $s->execute([$nome, $email, $tel, password_hash($senha, PASSWORD_DEFAULT)]);
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$db->lastInsertId();
    out(['sucesso' => true, 'usuario' => pub(usuarioLogado($db))]);

  case 'login':
    $email = strtolower(campo('email')); $senha = (string)($_POST['senha'] ?? '');
    $s = $db->prepare('SELECT * FROM usuarios WHERE email=?'); $s->execute([$email]);
    $u = $s->fetch();
    if (!$u || !password_verify($senha, $u['senha_hash'])) fail('E-mail ou senha incorretos.');
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    out(['sucesso' => true, 'usuario' => pub($u)]);

  case 'logout':
    $_SESSION = []; session_destroy();
    out(['sucesso' => true]);

  case 'atualizar_perfil':
    $u = exigeLogin($db);
    $nome = campo('nome');
    if ($nome === '') fail('Informe seu nome.');
    $db->prepare('UPDATE usuarios SET nome=?, telefone=? WHERE id=?')->execute([$nome, campo('telefone'), $u['id']]);
    out(['sucesso' => true, 'usuario' => pub(usuarioLogado($db))]);

  /* ---------- Pedidos do cliente ---------- */
  case 'criar_pedido':
    $u = exigeLogin($db);
    $nome = campo('nome');
    if ($nome === '') fail('Pedido inválido.');
    $db->prepare('INSERT INTO pedidos (usuario_id,nome,tipo,preco) VALUES (?,?,?,?)')
       ->execute([$u['id'], $nome, campo('tipo'), campo('preco')]);
    out(['sucesso' => true]);

  case 'meus_pedidos':
    $u = exigeLogin($db);
    $s = $db->prepare('SELECT id,nome,tipo,preco,status,data FROM pedidos WHERE usuario_id=? ORDER BY id DESC');
    $s->execute([$u['id']]);
    out($s->fetchAll());

  case 'limpar_pedidos':
    $u = exigeLogin($db);
    $db->prepare('DELETE FROM pedidos WHERE usuario_id=?')->execute([$u['id']]);
    out(['sucesso' => true]);

  /* ---------- Produtos ---------- */
  case 'listar_produtos':
    out($db->query('SELECT id,categoria,nome,descricao,preco,imagem,badge FROM produtos ORDER BY id')->fetchAll());

  case 'cadastrar_produto':
  case 'editar_produto':
    exigeAdmin($db);
    $nome = campo('nome');
    if ($nome === '') fail('Informe o nome do produto.');
    $imagem = campo('imagem');
    if ($imagem !== '' && !preg_match('#^https?://#i', $imagem)) fail('URL da imagem inválida.');
    $d = [campo('categoria'), $nome, campo('descricao'), (float)($_POST['preco'] ?? 0), $imagem, campo('badge')];
    if ($acao === 'editar_produto') {
      $db->prepare('UPDATE produtos SET categoria=?,nome=?,descricao=?,preco=?,imagem=?,badge=? WHERE id=?')->execute([...$d, (int)($_POST['id'] ?? 0)]);
    } else {
      $db->prepare('INSERT INTO produtos (categoria,nome,descricao,preco,imagem,badge) VALUES (?,?,?,?,?,?)')->execute($d);
    }
    out(['sucesso' => true]);

  case 'excluir_produto':
    exigeAdmin($db);
    $db->prepare('DELETE FROM produtos WHERE id=?')->execute([(int)($_POST['id'] ?? 0)]);
    out(['sucesso' => true]);

  /* ---------- Admin: pedidos e usuários ---------- */
  case 'listar_pedidos':
    exigeAdmin($db);
    out($db->query('SELECT p.id,p.nome,p.tipo,p.preco,p.status,p.data,u.nome AS cliente,u.email
                    FROM pedidos p JOIN usuarios u ON u.id=p.usuario_id ORDER BY p.id DESC')->fetchAll());

  case 'atualizar_status_pedido':
    exigeAdmin($db);
    $st = campo('status');
    if (!in_array($st, ['pendente', 'concluido'], true)) fail('Status inválido.');
    $db->prepare('UPDATE pedidos SET status=? WHERE id=?')->execute([$st, (int)($_POST['id'] ?? 0)]);
    out(['sucesso' => true]);

  case 'excluir_pedido':
    exigeAdmin($db);
    $db->prepare('DELETE FROM pedidos WHERE id=?')->execute([(int)($_POST['id'] ?? 0)]);
    out(['sucesso' => true]);

  case 'listar_usuarios':
    exigeAdmin($db);
    out($db->query('SELECT nome,email,telefone,papel,data_cadastro FROM usuarios ORDER BY id DESC')->fetchAll());

  default:
    fail('Ação desconhecida.', 400);
}
