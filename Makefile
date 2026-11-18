up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

seed:
	docker compose exec api python -m app.seed

test:
	cd apps/api && pip install -r requirements.txt -r requirements-dev.txt && python -m pytest -q

reset-db:
	docker compose down -v

audit:
	cd apps/web && npm audit --omit=dev
	pip install pip-audit && cd apps/api && pip-audit -r requirements.txt
