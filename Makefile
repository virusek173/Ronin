.PHONY: up down restart

up:
	docker build -t ronin . && docker run -d --name ronin --env-file .env --restart unless-stopped ronin

down:
	docker stop ronin && docker rm ronin

restart: down up
