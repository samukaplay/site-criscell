<?php
// Uso (no terminal, dentro da pasta do site):  php criar_admin.php seu@email.com SuaSenhaForte
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Somente via terminal.'); }
if ($argc < 3) exit("Uso: php criar_admin.php email senha\n");
[$_, $email, $senha] = $argv;
$db = new PDO('sqlite:' . __DIR__ . '/criscell.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  telefone TEXT DEFAULT '', senha_hash TEXT NOT NULL, papel TEXT NOT NULL DEFAULT 'cliente',
  data_cadastro TEXT NOT NULL DEFAULT (datetime('now','localtime')))");
$email = strtolower($email);
$hash = password_hash($senha, PASSWORD_DEFAULT);
$s = $db->prepare('SELECT id FROM usuarios WHERE email=?'); $s->execute([$email]);
if ($s->fetch()) {
  $db->prepare("UPDATE usuarios SET papel='admin', senha_hash=? WHERE email=?")->execute([$hash, $email]);
  echo "Usuário existente promovido a admin.\n";
} else {
  $db->prepare("INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES ('Administrador',?,?, 'admin')")->execute([$email, $hash]);
  echo "Administrador criado.\n";
}
