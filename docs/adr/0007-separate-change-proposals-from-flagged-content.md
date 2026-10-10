# Separate Change Proposals from User Flagged Content

Automated ingestion uses dedicated tables (`change_proposals` and `change_proposal_items`) rather than overloading the existing `flagged_content` moderation table. The user flagging system was designed strictly for single-entity user bug reports with mandatory human contact constraints and single-table flat updates, whereas agent ingestion requires batch transactions across rental shops, motorcycle insertion, child rate-tier records, and soft deactivations.
