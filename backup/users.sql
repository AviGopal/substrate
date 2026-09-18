-- =============================================================================
-- Table: users
-- =============================================================================
-- Stores user accounts for authentication and identification.
-- Designed for PostgreSQL (portable to MySQL/SQLite with minor adjustments).
-- =============================================================================

CREATE TABLE users (
    -- Primary key
    id              BIGSERIAL       PRIMARY KEY,

    -- Core identity
    email           VARCHAR(255)    NOT NULL UNIQUE,

    -- Authentication
    password_hash   VARCHAR(255)    NOT NULL,

    -- Audit timestamps
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast email lookups (login, signup, and duplicate checks)
CREATE INDEX idx_users_email ON users (email);

-- =============================================================================
-- Design rationale
-- =============================================================================
-- id            : Auto-incrementing big-integer PK; BIGSERIAL accommodates
--                 growth beyond 2^31 rows. Simple, efficient for joins.
-- email         : 255 chars covers the RFC 5321 maximum for practical email
--                 addresses; NOT NULL UNIQUE - every user must have exactly
--                 one email, and email-based login requires O(1) lookups.
-- password_hash : Stores a salted, computationally-expensive hash of the
--                 user password (e.g. Argon2id, bcrypt, or scrypt), NEVER
--                 the plain-text password. VARCHAR(255) is sufficient for
--                 any standard hash output (bcrypt = 60 chars, Argon2id
--                 approx 97 chars). NOT NULL because every local-auth user
--                 must have a credential. (SSO-only users would use a
--                 separate auth-providers table, not a NULL hash.)
-- created_at    : Audit trail; records when the account was created.
--                 DEFAULT CURRENT_TIMESTAMP means the application never
--                 needs to supply this value on INSERT.
-- =============================================================================

-- =============================================================================
-- Why passwords are NEVER stored in plain text
-- =============================================================================
-- 1. Data-breach containment
--    If the database is compromised (SQL injection, backup leak, insider
--    threat, misconfigured S3 bucket, etc.), plain-text passwords are
--    immediately usable by the attacker - not just against YOUR system but
--    against every other service where the user reused that password
--    (credential stuffing). A hash ensures the attacker must run an
--    expensive brute-force or dictionary attack per account, buying time
--    for affected users to change passwords.
--
-- 2. Irreversibility
--    A cryptographic hash function is a one-way transformation: even the
--    database administrator cannot recover the original password from the
--    hash. This enforces the principle that no entity - human or system -
--    should be able to read a user password. Authentication works by
--    hashing the submitted password at login time and comparing the result
--    to the stored hash, never by decrypting or reading the stored value.
--
-- 3. Salting defeats rainbow tables
--    Modern hash functions (Argon2id, bcrypt, scrypt) embed a per-user
--    random salt inside the hash output. Even if two users choose the same
--    password, their stored hashes are completely different. This makes
--    pre-computed lookup tables (rainbow tables) useless, forcing the
--    attacker to attack each hash individually.
--
-- 4. Computational cost slows brute force
--    Unlike raw SHA-256 (designed to be fast), password hashing functions
--    are deliberately slow and memory-hard. Argon2id, for example, can be
--    tuned to require approx 100 ms and 64 MB of memory per hash, making a
--    10-million-guess dictionary attack take weeks instead of seconds.
--
-- 5. Regulatory and compliance requirements
--    Standards such as NIST SP 800-63B, PCI DSS, GDPR, and SOC 2 all
--    mandate that passwords be stored only in hashed form. Storing plain-
--    text passwords is a direct violation and can result in fines, loss
--    of certification, and legal liability.
--
-- 6. Trust and user expectations
--    Users trust that a service cannot read their password. Storing it in
--    plain text violates that trust and, if disclosed, causes catastrophic
--    reputational damage (see: the Adobe 2013 breach of 153 million plain-
--    text passwords).
-- =============================================================================
