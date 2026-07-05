#!/bin/bash
find src -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i 's|fetch(\x27/api/|fetch(import.meta.env.VITE_API_BASE_URL + \x27/api/|g'
find src -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i 's|fetch(`/api/|fetch(`${import.meta.env.VITE_API_BASE_URL}/api/|g'
