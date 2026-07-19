import io

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.auth.dependencies import get_current_admin
from backend.db.models import AdminUser, RollNumberMapping, Section
from backend.db.session import get_db
from backend.main import app


@pytest.fixture
def admin_client(db):
    admin_user = AdminUser(username="admin", hashed_password="pwd")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clean_db(db):
    from backend.db.models import ClassSession, RollNumberMapping, Section

    db.query(ClassSession).delete()
    db.query(RollNumberMapping).delete()
    db.query(Section).delete()
    db.commit()


def test_upload_roll_mappings_csv_success(admin_client, db):
    # Setup sections
    sec1 = Section(section_name="CS1", year=2)
    sec2 = Section(section_name="CS2", year=2)
    db.add_all([sec1, sec2])
    db.commit()

    # Create CSV file content
    csv_content = 'roll_no,section\n2105123,CS1\n2105124,CS2\n2105125,"CS1,CS2"\n'

    file_payload = {"file": ("mappings.csv", csv_content, "text/csv")}
    form_payload = {"academic_year": 2}

    response = admin_client.post(
        "/admin/roll-mappings/upload", files=file_payload, data=form_payload
    )

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert (
        res_data["created_count"] == 4
    )  # 2105123->CS1 (1), 2105124->CS2 (1), 2105125->CS1,CS2 (2)
    assert res_data["deleted_count"] == 0

    # Verify database contents
    mappings = db.query(RollNumberMapping).all()
    assert len(mappings) == 4
    roll_to_secs = {}
    for m in mappings:
        roll_to_secs.setdefault(m.roll_no, []).append(m.section.section_name)

    assert roll_to_secs["2105123"] == ["CS1"]
    assert roll_to_secs["2105124"] == ["CS2"]
    assert set(roll_to_secs["2105125"]) == {"CS1", "CS2"}


def test_upload_roll_mappings_excel_success(admin_client, db):
    # Setup sections
    sec = Section(section_name="HPC1", year=3)
    db.add(sec)
    db.commit()

    # Create Excel file content using pandas
    df = pd.DataFrame({"Roll No": [3105001, 3105002], "Section Name": ["HPC1", "HPC1"]})

    excel_io = io.BytesIO()
    df.to_excel(excel_io, index=False)
    excel_io.seek(0)

    file_payload = {
        "file": (
            "mappings.xlsx",
            excel_io.read(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    }
    form_payload = {"academic_year": 3}

    response = admin_client.post(
        "/admin/roll-mappings/upload", files=file_payload, data=form_payload
    )

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert res_data["created_count"] == 2
    assert res_data["deleted_count"] == 0


def test_upload_roll_mappings_missing_section(admin_client, db):
    # No sections exist in DB
    csv_content = "roll_no,section\n2105123,NON_EXISTENT\n"
    file_payload = {"file": ("mappings.csv", csv_content, "text/csv")}
    form_payload = {"academic_year": 2}

    response = admin_client.post(
        "/admin/roll-mappings/upload", files=file_payload, data=form_payload
    )

    assert response.status_code == 422
    assert "not found" in response.json()["detail"].lower()


def test_upload_roll_mappings_scoping_overwrite(admin_client, db):
    # Setup sections for year 2 and year 3
    sec2 = Section(section_name="CS1", year=2)
    sec3 = Section(section_name="CS1", year=3)
    db.add_all([sec2, sec3])
    db.commit()

    # Pre-populate some mappings
    m2 = RollNumberMapping(roll_no="222", section_id=sec2.id, academic_year=2)
    m3 = RollNumberMapping(roll_no="333", section_id=sec3.id, academic_year=3)
    db.add_all([m2, m3])
    db.commit()

    # Upload new mapping for year 2 only
    csv_content = "roll_no,section\n2105123,CS1\n"
    file_payload = {"file": ("mappings.csv", csv_content, "text/csv")}
    form_payload = {"academic_year": 2}

    response = admin_client.post(
        "/admin/roll-mappings/upload", files=file_payload, data=form_payload
    )

    assert response.status_code == 200
    assert response.json()["deleted_count"] == 1

    # Verify that mapping for year 3 still exists, but year 2 mapping was overwritten
    y2_mappings = db.query(RollNumberMapping).filter(RollNumberMapping.academic_year == 2).all()
    assert len(y2_mappings) == 1
    assert y2_mappings[0].roll_no == "2105123"

    y3_mappings = db.query(RollNumberMapping).filter(RollNumberMapping.academic_year == 3).all()
    assert len(y3_mappings) == 1
    assert y3_mappings[0].roll_no == "333"


def test_upload_roll_mappings_normalization(admin_client, db):
    # Setup sections in database
    sec1 = Section(section_name="CS53", year=3)
    sec2 = Section(section_name="IT2", year=3)
    db.add_all([sec1, sec2])
    db.commit()

    # Upload CSV with various section name formats
    # 53 -> CS53, CS-53 -> CS53, CSE-53 -> CS53, IT-2 -> IT2, CS 53 -> CS53
    csv_content = (
        "roll_no,section\n"
        "1001,53\n"
        "1002,CS-53\n"
        "1003,CSE-53\n"
        "1004,IT-2\n"
        "1005,CS 53\n"
    )

    file_payload = {"file": ("mappings.csv", csv_content, "text/csv")}
    form_payload = {"academic_year": 3}

    response = admin_client.post(
        "/admin/roll-mappings/upload", files=file_payload, data=form_payload
    )

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert res_data["created_count"] == 5

    # Verify matching in database
    mappings = db.query(RollNumberMapping).order_by(RollNumberMapping.roll_no).all()
    assert len(mappings) == 5
    
    # 1001 -> 53 -> CS53
    assert mappings[0].roll_no == "1001"
    assert mappings[0].section.section_name == "CS53"

    # 1002 -> CS-53 -> CS53
    assert mappings[1].roll_no == "1002"
    assert mappings[1].section.section_name == "CS53"

    # 1003 -> CSE-53 -> CS53
    assert mappings[2].roll_no == "1003"
    assert mappings[2].section.section_name == "CS53"

    # 1004 -> IT-2 -> IT2
    assert mappings[3].roll_no == "1004"
    assert mappings[3].section.section_name == "IT2"

    # 1005 -> CS 53 -> CS53
    assert mappings[4].roll_no == "1005"
    assert mappings[4].section.section_name == "CS53"


def test_upload_roll_mappings_explicit_columns_success(admin_client, db):
    sec = Section(section_name="CS1", year=2)
    db.add(sec)
    db.commit()

    csv_content = 'weird_roll,weird_section\n2105123,CS1\n'
    file_payload = {"file": ("mappings.csv", csv_content, "text/csv")}
    form_payload = {
        "academic_year": 2,
        "roll_col_name": "weird_roll",
        "sec_col_name": "weird_section"
    }

    response = admin_client.post(
        "/admin/roll-mappings/upload", files=file_payload, data=form_payload
    )

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["created_count"] == 1


def test_upload_roll_mappings_explicit_columns_not_found(admin_client, db):
    csv_content = 'weird_roll,weird_section\n2105123,CS1\n'
    file_payload = {"file": ("mappings.csv", csv_content, "text/csv")}
    
    # Missing roll column
    form_payload = {
        "academic_year": 2,
        "roll_col_name": "missing_roll",
        "sec_col_name": "weird_section"
    }
    response = admin_client.post(
        "/admin/roll-mappings/upload", files=file_payload, data=form_payload
    )
    assert response.status_code == 422
    assert "not found in file" in response.json()["detail"].lower()
    
    # Missing sec column
    form_payload = {
        "academic_year": 2,
        "roll_col_name": "weird_roll",
        "sec_col_name": "missing_sec"
    }
    response = admin_client.post(
        "/admin/roll-mappings/upload", files=file_payload, data=form_payload
    )
    assert response.status_code == 422
    assert "not found in file" in response.json()["detail"].lower()


def test_inspect_roll_mappings_success(admin_client, db):
    csv_content = 'weird_roll,weird_section\n2105123,CS1\n'
    file_payload = {"file": ("mappings.csv", csv_content, "text/csv")}
    response = admin_client.post(
        "/admin/roll-mappings/inspect", files=file_payload
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["columns"] == ["weird_roll", "weird_section"]

