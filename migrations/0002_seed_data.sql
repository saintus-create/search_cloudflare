-- Sample documents
INSERT INTO documents (url, title, content, metadata) VALUES ('https://example.com/1', 'Example Document 1', 'This is sample content about child custody and family law in California.', '{"category":"general"}');
INSERT INTO documents (url, title, content, metadata) VALUES ('https://example.com/2', 'Example Document 2', 'This document covers support payments and enforcement under the California Family Code.', '{"category":"support"}');
INSERT INTO documents (url, title, content, metadata) VALUES ('https://example.com/3', 'Example Document 3', 'Community property division and asset allocation in California divorce proceedings.', '{"category":"property"}');
INSERT INTO documents (url, title, content, metadata) VALUES ('https://example.com/4', 'Example Document 4', 'Domestic violence restraining orders and protective measures under California law.', '{"category":"protection"}');
INSERT INTO documents (url, title, content, metadata) VALUES ('https://example.com/5', 'Example Document 5', 'Adoption procedures and requirements in the state of California.', '{"category":"adoption"}');

-- Sample sections hierarchy
INSERT INTO divisions (division_number, division_title) VALUES ('1', 'Preliminary Provisions');
INSERT INTO divisions (division_number, division_title) VALUES ('2', 'Dissolution of Marriage');

INSERT INTO parts (division_id, part_number, part_title) VALUES (1, '1', 'Short Title and Purpose');
INSERT INTO parts (division_id, part_number, part_title) VALUES (2, '1', 'Dissolution of Marriage');

INSERT INTO chapters (part_id, chapter_number, chapter_title) VALUES (2, '1', 'Dissolution of Marriage');

INSERT INTO sections (chapter_id, part_id, division_id, section_number, section_number_citation, section_text) VALUES (1, 2, 2, '2000', 'Fam. Code § 2000', 'The family code governs marriage, divorce, and child custody matters in California.');
INSERT INTO sections (chapter_id, part_id, division_id, section_number, section_number_citation, section_text) VALUES (1, 2, 2, '2010', 'Fam. Code § 2010', 'Either spouse may file for dissolution of marriage on the grounds of irreconcilable differences.');
INSERT INTO sections (chapter_id, part_id, division_id, section_number, section_number_citation, section_text) VALUES (1, 2, 2, '3010', 'Fam. Code § 3010', 'Both parents are equally entitled to the custody of their children in any proceeding under this code.');
INSERT INTO sections (chapter_id, part_id, division_id, section_number, section_number_citation, section_text) VALUES (1, 2, 2, '3020', 'Fam. Code § 3020', 'The court shall ensure that the health, safety, and welfare of the child is the paramount concern.');
INSERT INTO sections (chapter_id, part_id, division_id, section_number, section_number_citation, section_text) VALUES (1, 2, 2, '4000', 'Fam. Code § 4000', 'Child support shall be determined according to the statewide uniform guideline.');
