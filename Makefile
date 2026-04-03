SHELL := /bin/sh

COMPOSE ?= podman-compose

.PHONY: help env build up upd down destroy restart ps logs logs-api logs-web logs-db typecheck app-build

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

env: ## Create .env from .env.example if missing
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	else \
		echo ".env already exists"; \
	fi

build: env ## Build all containers
	$(COMPOSE) build

up: env ## Run the full stack in the foreground
	$(COMPOSE) up --build

upd: env ## Run the full stack in the background
	$(COMPOSE) up --build -d

down: ## Stop the stack
	$(COMPOSE) down

destroy: ## Stop the stack and remove volumes
	$(COMPOSE) down -v

restart: ## Restart the running stack
	$(COMPOSE) restart

ps: ## Show container status
	$(COMPOSE) ps

logs: ## Follow logs for all services
	$(COMPOSE) logs -f

logs-api: ## Follow API logs
	$(COMPOSE) logs -f api

logs-web: ## Follow web logs
	$(COMPOSE) logs -f web

logs-db: ## Follow postgres and redis logs
	$(COMPOSE) logs -f postgres redis

typecheck: ## Run TypeScript checks
	COREPACK_HOME=/tmp/corepack corepack pnpm typecheck

app-build: ## Build app packages without containers
	COREPACK_HOME=/tmp/corepack corepack pnpm build
