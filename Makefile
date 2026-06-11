.PHONY: up down restart restart-hard logs

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose restart

restart-hard:
	$(MAKE) down
	$(MAKE) up

logs:
	docker compose logs -f
