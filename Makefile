# Unicity-AOS9 User Guide — packaging targets
#
# Produces customer-ready deliverables under dist/ (gitignored):
#   - dist/unicity-aos9-user-guide-YYYY-MM-DD.zip   (static site, opens locally)
#   - dist/unicity-aos9-user-guide-YYYY-MM-DD.pdf   (single PDF of all pages)
#
# Both formats are offline-friendly. The zip extracts to a folder; open
# index.html in any browser — the full sidebar + client-side search works
# with no server. The PDF is one printable file with every page.
#
# All paths are anchored to ROOT (this Makefile's directory). No relative
# cd anywhere — recipes work regardless of where `make` is invoked from
# (`make -C ...`, `make -f /abs/Makefile`, etc.).

ROOT     := $(realpath $(dir $(firstword $(MAKEFILE_LIST))))
DATE     := $(shell date +%Y-%m-%d)
PACKAGE  := unicity-aos9-user-guide-$(DATE)
DIST     := $(ROOT)/dist
ZIP      := $(DIST)/$(PACKAGE).zip
PDF      := $(DIST)/$(PACKAGE).pdf
# Staging copy of dist/ with URLs rewritten for file:// browsing. Lives
# outside dist/ so the PDF target keeps using the unmodified build.
STAGE    := $(ROOT)/.zip-staging

.PHONY: help install build zip pdf package clean

help:
	@echo "Unicity-AOS9 User Guide — make targets"
	@echo
	@echo "  install   First-time setup: npm install + playwright chromium"
	@echo "            (chromium download is ~150 MB; only needed for PDF)"
	@echo "  build     Run Astro build → $(DIST)/"
	@echo "  zip       build + produce $(ZIP)"
	@echo "  pdf       build + produce $(PDF)"
	@echo "  package   build + both artefacts"
	@echo "  clean     remove $(DIST)/"
	@echo
	@echo "Send the resulting .zip and .pdf to a customer — both artefacts are"
	@echo "self-contained and offline-friendly."

install:
	cd $(ROOT) && npm install
	cd $(ROOT) && npx playwright install chromium

build:
	cd $(ROOT) && npm run build

# zip target stages a copy of dist/ with server-absolute URLs rewritten to
# page-relative form (so customers can double-click index.html and read it
# without running a web server), then archives the staging dir. The zip is
# written to ROOT first and moved into DIST to avoid the recursive-archive
# pattern (zipping a directory while writing the archive into that same
# directory).
zip: build
	@echo "▶ preparing offline-portable HTML for ZIP…"
	rm -rf $(STAGE)
	cd $(ROOT) && node $(ROOT)/scripts/prepare-zip.mjs $(DIST) $(STAGE)
	@echo "▶ packaging zip…"
	cd $(STAGE) && zip -rq $(ROOT)/$(PACKAGE).zip . -x '*.zip' '*.pdf'
	mv $(ROOT)/$(PACKAGE).zip $(ZIP)
	rm -rf $(STAGE)
	@echo "→ $(ZIP) ($$(du -h $(ZIP) | cut -f1))"

pdf: build
	@if [ ! -d $(ROOT)/node_modules/playwright ] || [ ! -d $(ROOT)/node_modules/pdf-lib ]; then \
		echo "❌ Missing devDependencies. Run: make install"; \
		exit 1; \
	fi
	@echo "▶ packaging pdf…"
	cd $(ROOT) && node $(ROOT)/scripts/build-pdf.mjs "$(PDF)"
	@echo "→ $(PDF) ($$(du -h $(PDF) | cut -f1))"

package: zip pdf
	@echo
	@echo "✓ customer deliverables ready:"
	@ls -lh $(ZIP) $(PDF)

clean:
	rm -rf $(DIST) $(STAGE)
