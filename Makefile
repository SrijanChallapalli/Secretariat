.PHONY: setup dev dev-app dev-server build lint format check deploy-og deploy-adi seed

setup:
	npm run setup

dev:
	npm run dev

dev-app:
	npm run dev:app

dev-server:
	npm run dev:server

build:
	npm run build

lint:
	npm run lint

format:
	npm run format

check:
	npm run check

deploy-og:
	npm run deploy:og

deploy-adi:
	npm run deploy:adi

seed:
	npm run seed:demo
