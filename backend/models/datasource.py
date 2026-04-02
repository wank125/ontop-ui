from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DataSourceBase(BaseModel):
    name: str
    jdbc_url: str
    user: str
    password: str
    driver: str = "org.postgresql.Driver"


class DataSourceCreate(DataSourceBase):
    pass


class DataSourceUpdate(BaseModel):
    name: Optional[str] = None
    jdbc_url: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    driver: Optional[str] = None


class DataSource(DataSourceBase):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BootstrapRequest(BaseModel):
    base_iri: str = "http://example.com/ontop/"
    output_dir: Optional[str] = None
