-- ⚠️ ATENÇÃO: Execute este script APENAS no projeto 'govsentinel-core' (o projeto errado)
-- Isso vai remover as tabelas do Kanban que foram criadas por engano.
-- NÃO execute isso no projeto novo/correto.

DROP TABLE IF EXISTS "checklist_items";
DROP TABLE IF EXISTS "card_checklists";
DROP TABLE IF EXISTS "card_attachments";
DROP TABLE IF EXISTS "card_tags";
DROP TABLE IF EXISTS "tags";
DROP TABLE IF EXISTS "card_members";
DROP TABLE IF EXISTS "card_comments";
DROP TABLE IF EXISTS "cards";
DROP TABLE IF EXISTS "lists";
DROP TABLE IF EXISTS "board_members";
DROP TABLE IF EXISTS "boards";
DROP TABLE IF EXISTS "submission_attachments";
DROP TABLE IF EXISTS "client_submissions";
DROP TABLE IF EXISTS "activity_log";

-- NÃO estamos removendo a tabela 'users' para não apagar usuários do outro projeto.
-- Se a tabela 'users' também foi criada por engano e está vazia ou incorreta, você pode removê-la manualmente,
-- mas é mais seguro deixá-la quieta se houver dúvida.
