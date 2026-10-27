-- CrisCell — estrutura do banco de dados (MySQL/MariaDB do XAMPP)
-- Não é preciso importar manualmente: a API cria o banco e as tabelas
-- sozinha na primeira requisição. Este arquivo serve de referência e
-- também pode ser importado pelo phpMyAdmin, se preferir.

CREATE DATABASE IF NOT EXISTS criscell CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE criscell;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  phone         VARCHAR(30)  NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('cliente','admin') NOT NULL DEFAULT 'cliente',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category    VARCHAR(80)  NOT NULL DEFAULT '',
  name        VARCHAR(160) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  image       VARCHAR(500) NOT NULL DEFAULT '',
  badge       VARCHAR(40)  NOT NULL DEFAULT '',
  badge_class VARCHAR(60)  NOT NULL DEFAULT 'bg-blue-accent text-white',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS services (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  title         VARCHAR(160) NOT NULL,
  description   VARCHAR(500) NOT NULL DEFAULT '',
  price         DECIMAL(10,2) NOT NULL DEFAULT 0,
  image         VARCHAR(500) NOT NULL DEFAULT '',
  whatsapp_text VARCHAR(200) NOT NULL DEFAULT '',
  sort_order    INT NOT NULL DEFAULT 0,
  active        TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  title           VARCHAR(200) NOT NULL,
  type            ENUM('servico','produto','carrinho') NOT NULL,
  total           DECIMAL(10,2) NULL,
  status          ENUM('pendente','concluido') NOT NULL DEFAULT 'pendente',
  customer_hidden TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_user (user_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED NOT NULL,
  kind       ENUM('servico','produto') NOT NULL,
  item_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(160) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  qty        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
