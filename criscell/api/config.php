<?php
// Configuração padrão do XAMPP: MySQL em localhost, usuário "root" sem senha.
// Se você definiu senha para o root no XAMPP, preencha 'db_pass'.
return [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'criscell',
    'db_user' => 'root',
    'db_pass' => '',

    // Conta de administrador criada automaticamente na primeira execução.
    // TROQUE a senha antes de publicar o site em um servidor real.
    'admin_name'     => 'Administrador',
    'admin_email'    => 'admin@criscell.com',
    'admin_password' => 'admin123',
];
