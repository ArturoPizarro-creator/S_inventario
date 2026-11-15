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
