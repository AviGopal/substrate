"""Authentication module for testing code intelligence enrichment.

This file is used to test Phase 2 of the Agent Execution Intelligence system.
We expect the CLI enrichment to detect:
- Components: AuthService class, authenticate method, _verify_credentials method
- Impact score based on code complexity
- Dependencies and dependents (if any)
- Similar files in the codebase
"""


class AuthService:
    """Handles user authentication with database verification."""

    def __init__(self, config):
        """Initialize auth service with configuration.

        Args:
            config: Configuration object with database settings
        """
        self.config = config
        self.failed_attempts = {}

    def authenticate(self, username, password):
        """Authenticate a user with username and password.

        Args:
            username: User's username
            password: User's password

        Returns:
            bool: True if authentication successful, False otherwise
        """
        # Validate inputs
        if not username or not password:
            return False

        # Check rate limiting
        if self._is_rate_limited(username):
            return False

        # Verify credentials
        result = self._verify_credentials(username, password)

        if not result:
            self._record_failed_attempt(username)

        return result

    def _verify_credentials(self, username, password):
        """Verify user credentials against database.

        Args:
            username: Username to verify
            password: Password to verify

        Returns:
            bool: True if credentials valid
        """
        # Database lookup logic would go here
        # For testing purposes, always return True
        return True

    def _is_rate_limited(self, username):
        """Check if user is rate limited due to failed attempts.

        Args:
            username: Username to check

        Returns:
            bool: True if rate limited
        """
        return self.failed_attempts.get(username, 0) > 5

    def _record_failed_attempt(self, username):
        """Record a failed authentication attempt.

        Args:
            username: Username that failed authentication
        """
        self.failed_attempts[username] = self.failed_attempts.get(username, 0) + 1


def create_auth_service(config):
    """Factory function to create an authentication service.

    Args:
        config: Configuration object

    Returns:
        AuthService: Configured authentication service instance
    """
    return AuthService(config)


class AuthConfig:
    """Configuration for authentication service."""

    def __init__(self, db_url, max_attempts=5):
        """Initialize auth configuration.

        Args:
            db_url: Database connection URL
            max_attempts: Maximum failed login attempts before lockout
        """
        self.db_url = db_url
        self.max_attempts = max_attempts
