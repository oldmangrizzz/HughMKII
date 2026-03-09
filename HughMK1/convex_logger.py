import os
import time
from convex import ConvexClient

class ConvexLogger:
    def __init__(self, source="unknown"):
        self.url = os.getenv("CONVEX_URL")
        self.source = source
        self.client = None
        if self.url:
            try:
                self.client = ConvexClient(self.url)
            except Exception as e:
                print(f"⚠️ Failed to initialize Convex client: {e}")
        else:
            # Only warn once
            pass

    def log(self, level, message, context=None):
        timestamp = time.time()
        
        # Console output
        print(f"[{self.source}] [{level}] {message}")
        
        # Convex output
        if self.client:
            try:
                self.client.mutation("logs:log", {
                    "source": self.source,
                    "level": level,
                    "message": message,
                    "context": context,
                    "timestamp": timestamp
                })
            except Exception as e:
                print(f"❌ Failed to send log to Convex: {e}")

    def info(self, message, context=None):
        self.log("INFO", message, context)

    def error(self, message, context=None):
        self.log("ERROR", message, context)
        
    def warning(self, message, context=None):
        self.log("WARNING", message, context)
