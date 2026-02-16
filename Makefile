.PHONY: help install dev build clean check-prereqs install-rust check-node check-rust check-xcode fix-xcode format lint test

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Pluely - Invisible AI Assistant$(NC)"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

check-prereqs: check-node check-rust check-xcode ## Check if all prerequisites are installed
	@echo "$(GREEN)✓ All prerequisites are installed$(NC)"

check-node: ## Check if Node.js is installed
	@echo "$(BLUE)Checking Node.js...$(NC)"
	@which node > /dev/null || (echo "$(RED)✗ Node.js is not installed. Please install Node.js v18 or higher.$(NC)" && exit 1)
	@node --version | grep -q "v1[89]\|v2[0-9]" || (echo "$(YELLOW)⚠ Warning: Node.js version should be v18 or higher$(NC)" || true)
	@echo "$(GREEN)✓ Node.js is installed: $$(node --version)$(NC)"

check-rust: ## Check if Rust is installed
	@echo "$(BLUE)Checking Rust...$(NC)"
	@which rustc > /dev/null || (echo "$(RED)✗ Rust is not installed. Run 'make install-rust' or visit https://rustup.rs/$(NC)" && exit 1)
	@which cargo > /dev/null || (echo "$(RED)✗ Cargo is not installed. Run 'make install-rust' or visit https://rustup.rs/$(NC)" && exit 1)
	@echo "$(GREEN)✓ Rust is installed: $$(rustc --version)$(NC)"
	@echo "$(GREEN)✓ Cargo is installed: $$(cargo --version)$(NC)"

check-xcode: ## Check if Xcode command line tools are installed (macOS only)
	@if [ "$$(uname)" = "Darwin" ]; then \
		echo "$(BLUE)Checking Xcode command line tools...$(NC)"; \
		xcode-select -p > /dev/null 2>&1 || (echo "$(RED)✗ Xcode command line tools are not installed. Run 'xcode-select --install'$(NC)" && exit 1); \
		echo "$(GREEN)✓ Xcode command line tools are installed$(NC)"; \
	fi

fix-xcode: ## Fix Xcode setup issues (macOS only) - run this if you get cidre build errors
	@if [ "$$(uname)" = "Darwin" ]; then \
		echo "$(BLUE)Fixing Xcode setup...$(NC)"; \
		echo "$(YELLOW)This may take a few minutes. Please wait...$(NC)"; \
		sudo xcodebuild -runFirstLaunch || echo "$(YELLOW)⚠ Note: You may need to run 'sudo xcodebuild -runFirstLaunch' manually$(NC)"; \
		echo "$(GREEN)✓ Xcode setup complete$(NC)"; \
		echo "$(BLUE)If issues persist, try:$(NC)"; \
		echo "  1. sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"; \
		echo "  2. sudo xcodebuild -license accept"; \
		echo "  3. sudo xcodebuild -runFirstLaunch"; \
	else \
		echo "$(YELLOW)⚠ This command is only for macOS$(NC)"; \
	fi

install-rust: ## Install Rust using rustup (if not already installed)
	@echo "$(BLUE)Installing Rust...$(NC)"
	@which rustc > /dev/null && echo "$(GREEN)✓ Rust is already installed$(NC)" || ( \
		curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | RUSTUP_INIT_SKIP_PATH_CHECK=yes sh -s -- -y && \
		echo "$(GREEN)✓ Rust installed successfully$(NC)" && \
		echo "$(YELLOW)Add to your shell config (~/.zshrc or ~/.bash_profile):$(NC)" && \
		echo "  source \$$HOME/.cargo/env" && \
		echo "$(YELLOW)Or run this once in your current shell: source \$$HOME/.cargo/env$(NC)" \
	)

install: check-node ## Install all dependencies (Node.js and Rust)
	@echo "$(BLUE)Installing Node.js dependencies...$(NC)"
	@npm install
	@echo "$(GREEN)✓ Node.js dependencies installed$(NC)"
	@if ! which rustc > /dev/null; then \
		echo "$(YELLOW)⚠ Rust is not installed. Run 'make install-rust' to install it.$(NC)"; \
	else \
		echo "$(BLUE)Installing Rust dependencies (this may take a while on first run)...$(NC)"; \
		cd src-tauri && cargo fetch && echo "$(GREEN)✓ Rust dependencies installed$(NC)"; \
	fi

dev: check-prereqs ## Start development server
	@echo "$(BLUE)Starting development server...$(NC)"
	@npm run tauri dev

build: check-prereqs ## Build the application for production
	@echo "$(BLUE)Building application for production...$(NC)"
	@if [ "$$(uname)" = "Darwin" ]; then \
		echo "$(YELLOW)Note: If you encounter Xcode/cidre errors, run 'make fix-xcode' first$(NC)"; \
	fi
	@npm run tauri build || ( \
		echo "$(RED)✗ Build failed$(NC)"; \
		if [ "$$(uname)" = "Darwin" ]; then \
			echo "$(YELLOW)If you see Xcode/cidre errors, try running:$(NC)"; \
			echo "  make fix-xcode"; \
			echo "  sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"; \
		fi; \
		exit 1 \
	)
	@echo "$(GREEN)✓ Build complete! Check src-tauri/target/release/bundle/ for installers$(NC)"

build-frontend: check-node ## Build only the frontend
	@echo "$(BLUE)Building frontend...$(NC)"
	@npm run build
	@echo "$(GREEN)✓ Frontend build complete$(NC)"

clean: ## Clean build artifacts and dependencies
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf dist
	@rm -rf node_modules
	@cd src-tauri && cargo clean
	@echo "$(GREEN)✓ Clean complete$(NC)"

clean-build: ## Clean only build artifacts (keep dependencies)
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf dist
	@cd src-tauri && cargo clean
	@echo "$(GREEN)✓ Build artifacts cleaned$(NC)"

format: check-node check-rust ## Format code (frontend and Rust)
	@echo "$(BLUE)Formatting code...$(NC)"
	@npm run format 2>/dev/null || echo "$(YELLOW)⚠ No format script found in package.json$(NC)"
	@cd src-tauri && cargo fmt
	@echo "$(GREEN)✓ Code formatted$(NC)"

lint: check-node check-rust ## Lint code (frontend and Rust)
	@echo "$(BLUE)Linting code...$(NC)"
	@npm run lint 2>/dev/null || echo "$(YELLOW)⚠ No lint script found in package.json$(NC)"
	@cd src-tauri && cargo clippy -- -D warnings || echo "$(YELLOW)⚠ Clippy found issues$(NC)"

test: check-node check-rust ## Run tests (if available)
	@echo "$(BLUE)Running tests...$(NC)"
	@npm run test 2>/dev/null || echo "$(YELLOW)⚠ No test script found in package.json$(NC)"
	@cd src-tauri && cargo test 2>/dev/null || echo "$(YELLOW)⚠ No Rust tests found$(NC)"

setup: install install-rust ## Complete setup: install all dependencies including Rust
	@echo "$(GREEN)✓ Setup complete! Run 'make dev' to start development$(NC)"

update: ## Update dependencies
	@echo "$(BLUE)Updating dependencies...$(NC)"
	@npm update
	@cd src-tauri && cargo update
	@echo "$(GREEN)✓ Dependencies updated$(NC)"

info: ## Show project information and versions
	@echo "$(BLUE)Project Information:$(NC)"
	@echo "  Node.js: $$(node --version 2>/dev/null || echo 'Not installed')"
	@echo "  npm: $$(npm --version 2>/dev/null || echo 'Not installed')"
	@echo "  Rust: $$(rustc --version 2>/dev/null || echo 'Not installed')"
	@echo "  Cargo: $$(cargo --version 2>/dev/null || echo 'Not installed')"
	@echo "  Tauri CLI: $$(npm list -g @tauri-apps/cli 2>/dev/null | grep @tauri-apps/cli || echo 'Not installed globally')"
	@if [ "$$(uname)" = "Darwin" ]; then \
		echo "  Xcode: $$(xcode-select -p 2>/dev/null || echo 'Not installed')"; \
		echo "  Xcode Version: $$(xcodebuild -version 2>/dev/null | head -1 || echo 'Not available')"; \
	fi
	@echo ""
	@echo "$(BLUE)Project Structure:$(NC)"
	@echo "  Frontend: React + TypeScript + Vite"
	@echo "  Backend: Rust + Tauri v2"
	@echo "  Database: SQLite"

