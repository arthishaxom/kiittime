"""CLI script to create or update an AdminUser."""

import argparse
import getpass
import sys

from sqlalchemy import select

from backend.auth.security import hash_password
from backend.db.models import AdminUser
from backend.db.session import SessionLocal


def create_or_update_admin(username: str, password: str) -> None:
    db = SessionLocal()
    try:
        user = db.execute(
            select(AdminUser).where(AdminUser.username == username)
        ).scalar_one_or_none()

        hashed = hash_password(password)

        if user:
            user.hashed_password = hashed
            db.commit()
            print(f"✅ Updated existing admin user: {username}")
        else:
            new_user = AdminUser(username=username, hashed_password=hashed)
            db.add(new_user)
            db.commit()
            print(f"✅ Created new admin user: {username}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update an admin user")
    parser.add_argument("--username", "-u", type=str, help="Admin username")
    parser.add_argument("--password", "-p", type=str, help="Admin password (plaintext)")

    args = parser.parse_args()

    username = args.username or input("Enter admin username: ").strip()
    if not username:
        print("❌ Username cannot be empty", file=sys.stderr)
        sys.exit(1)

    password = args.password
    if not password:
        password = getpass.getpass("Enter admin password: ").strip()
    if not password:
        print("❌ Password cannot be empty", file=sys.stderr)
        sys.exit(1)

    create_or_update_admin(username, password)


if __name__ == "__main__":
    main()
