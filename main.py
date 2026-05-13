from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from name_fortune import GivenName, Surname, evaluate_structured


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Local Japanese Name Calculator")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class SurnameInput(BaseModel):
    text: str = Field(min_length=1)
    reading: str = Field(min_length=1)


class CandidateInput(BaseModel):
    text: str = Field(min_length=1)
    reading: str = Field(min_length=1)
    note: str = ""


class EvaluationRequest(BaseModel):
    surnames: list[SurnameInput] = Field(default_factory=list)
    candidates: list[CandidateInput] = Field(default_factory=list)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/evaluate")
def evaluate_names(request: EvaluationRequest) -> JSONResponse:
    try:
        surnames = [Surname(text=item.text.strip(), reading=item.reading.strip()) for item in request.surnames if item.text.strip() and item.reading.strip()]
        candidates = [GivenName(kanji=item.text.strip(), reading=item.reading.strip()) for item in request.candidates if item.text.strip() and item.reading.strip()]
        result: dict[str, Any] = evaluate_structured(surnames, candidates) if surnames and candidates else {
            "surnames": [],
            "candidates": [],
            "results": [],
            "analysis": [],
            "sources": {},
        }
        notes = {item.text.strip(): item.note for item in request.candidates if item.text.strip()}
        for candidate in result.get("candidates", []):
            candidate["note"] = notes.get(candidate["text"], "")
        return JSONResponse(result)
    except KeyError as exc:
        return JSONResponse(
            {
                "error": "unknown_character",
                "message": f"No stroke data is available for {exc.args[0]!r}.",
            },
            status_code=400,
        )


def main() -> None:
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
