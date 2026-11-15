from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProductIn(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    category: str = ""
    stock: int = Field(default=0, ge=0)
    min_stock: int = Field(default=0, ge=0)


class ProductOut(ProductIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class MovementIn(BaseModel):
    product_id: int
    kind: Literal["in", "out"]
    quantity: int = Field(gt=0)
    note: str = ""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = []
