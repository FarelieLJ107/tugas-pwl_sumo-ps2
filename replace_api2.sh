#!/bin/bash
find src -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i 's|import.meta.env.VITE_API_BASE_URL + \x27/api/|(import.meta.env.VITE_API_BASE_URL \|\| \x27\x27) + \x27/api/|g'
find src -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i 's|${import.meta.env.VITE_API_BASE_URL}/api/|${import.meta.env.VITE_API_BASE_URL \|\| \x27\x27}/api/|g'
