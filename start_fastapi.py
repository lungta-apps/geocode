#!/usr/bin/env python3
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=True  # For development
    )