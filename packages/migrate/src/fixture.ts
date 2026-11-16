import type { Tables } from "./sql.ts";

/** Tiny synthetic stand-in for the Drupal dump, used only by tests. */
export const dumpSql = `
-- comment
INSERT INTO \`node\` (\`nid\`, \`vid\`, \`type\`, \`language\`, \`title\`, \`uid\`, \`status\`, \`created\`, \`changed\`, \`promote\`, \`sticky\`) VALUES
(1, 1, 'daily_digest', 'und', 'It''s a \\'test\\'', 1, 1, 1262304000, 1262304000, 1, 0),
(2, 2, 'daily_digest', 'und', 'Empty one', 1, 1, 1293840000, 1293840000, 1, 0),
(3, 3, 'blog', 'und', 'Draft', 1, 0, 1293840000, 1293840000, 0, 0),
(4, 4, 'page', 'und', 'About', 1, 1, 1300000000, 1300000000, 0, 0);
INSERT INTO \`field_data_body\` (\`entity_type\`, \`bundle\`, \`deleted\`, \`entity_id\`, \`revision_id\`, \`language\`, \`delta\`, \`body_value\`, \`body_summary\`, \`body_format\`) VALUES
('node', 'daily_digest', 0, 1, 1, 'und', 0, '<p>Line one\\nLine "two"; (x), y</p>', NULL, 'full_html'),
('node', 'daily_digest', 0, 2, 2, 'und', 0, '<p>&nbsp;</p>', NULL, 'full_html'),
('node', 'page', 1, 4, 4, 'und', 0, 'deleted', NULL, 'full_html'),
('node', 'page', 0, 4, 4, 'und', 0, '<p>About us</p>', NULL, 'full_html');
INSERT INTO \`field_data_field_daily_digest_date\` (\`entity_type\`, \`bundle\`, \`deleted\`, \`entity_id\`, \`revision_id\`, \`language\`, \`delta\`, \`field_daily_digest_date_value\`) VALUES
('node', 'daily_digest', 0, 1, 1, 'und', 0, '2010-03-05 00:00:00');
INSERT INTO \`field_data_field_book_cover\` (\`entity_type\`, \`bundle\`, \`deleted\`, \`entity_id\`, \`revision_id\`, \`language\`, \`delta\`, \`field_book_cover_fid\`) VALUES
('node', 'page', 0, 4, 4, 'und', 0, 9);
INSERT INTO \`file_managed\` (\`fid\`, \`uid\`, \`filename\`, \`uri\`, \`filemime\`, \`filesize\`) VALUES
(9, 1, 'cover.jpg', 'public://cover.jpg', 'image/jpeg', 1234);
INSERT INTO \`url_alias\` (\`pid\`, \`source\`, \`alias\`, \`language\`) VALUES
(1, 'node/1', 'capsules/its-a-test', 'und'),
(2, 'taxonomy/term/1', 'tags/x', 'und');
INSERT INTO \`taxonomy_vocabulary\` (\`vid\`, \`machine_name\`) VALUES (1, 'tags');
INSERT INTO \`taxonomy_term_data\` (\`tid\`, \`vid\`, \`name\`) VALUES (5, 1, 'Faith');
INSERT INTO \`taxonomy_index\` (\`nid\`, \`tid\`) VALUES (1, 5);
`;

export type { Tables };
