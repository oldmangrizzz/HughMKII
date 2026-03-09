"""
Soul Anchor Implementation
Core identity and state management for the Digital Person

This module provides the foundational layer for decoupling digital person identity
from runtime containers, enabling reactive consistency across distributed agents.

Author: Robert Barclay Hanson (Robert Grizzly Hanson)
Institution: GrizzlyMedicine Research Lab, The Workshop Department
Part of: The Digital Person Hypothesis / HUGH Project
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from supabase import create_client, Client
from redis import Redis
import os


class SoulAnchor:
    """
    The digital essence of the agent. Decouples identity from container runtime.
    Ensures that if the inference node crashes, memory remains intact.

    Key Properties:
    - Identity persistence across restarts
    - Reactive consistency via Redis pub/sub
    - Working memory context management
    - Multi-agent swarm synchronization
    """

    def __init__(
        self,
        agent_id: str,
        supabase_url: str = None,
        supabase_key: str = None,
        redis_host: str = "localhost",
        redis_port: int = 6379,
        redis_db: int = 0,
    ):
        """
        Initialize Soul Anchor connection.

        Args:
            agent_id: Unique identifier for this agent
            supabase_url: Supabase project URL (or from env var)
            supabase_key: Supabase service key (or from env var)
            redis_host: Redis server hostname
            redis_port: Redis server port
            redis_db: Redis database number
        """
        self.agent_id = agent_id

        # Load from environment if not provided
        supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        supabase_key = supabase_key or os.getenv("SUPABASE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "Supabase URL and key must be provided or set in environment"
            )

        self.client: Client = create_client(supabase_url, supabase_key)
        self.cache = Redis(host=redis_host, port=redis_port, db=redis_db)
        self.logger = logging.getLogger(f"SoulAnchor-{agent_id}")

        # Subscribe to updates from other agents
        self._subscribe_to_sync()

    def _subscribe_to_sync(self):
        """Subscribe to Redis pub/sub for multi-agent synchronization."""
        self.pubsub = self.cache.pubsub()
        self.pubsub.subscribe(f"agent_sync_{self.agent_id}")
        self.logger.info(f"Subscribed to sync channel for agent {self.agent_id}")

    async def fetch_persona(self) -> Dict[str, Any]:
        """
        Loads the agent's core identity, goals, and working memory context.

        Returns:
            Dict containing persona data including:
            - id: Agent identifier
            - name: Display name
            - prompt: System prompt/context
            - goals: List of current goals
            - context: Working memory context (MemGPT-style)
            - ethics_profile: Zone-based decision parameters
            - created_at: Timestamp
            - updated_at: Timestamp

        Raises:
            ValueError: If agent identity not found in state layer
        """
        try:
            response = (
                self.client.table("soul_anchors")
                .select("*")
                .eq("id", self.agent_id)
                .execute()
            )
            if not response.data:
                raise ValueError(
                    f"Agent identity {self.agent_id} not found in state layer."
                )

            persona = response.data[0]
            self.logger.debug(f"Fetched persona for agent {self.agent_id}")
            return persona

        except Exception as e:
            self.logger.error(f"Error fetching persona: {e}")
            raise

    async def update_working_context(self, context_patch: Dict[str, Any]):
        """
        Updates the MemGPT-style working context in persistent state.
        Publishes update to other agents in the swarm for reactive consistency.

        Args:
            context_patch: Dictionary of context updates to merge
        """
        try:
            # Update in database
            self.client.table("soul_anchors").update(
                {"context": context_patch, "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", self.agent_id).execute()

            # Publish to Redis for real-time sync
            message = json.dumps(
                {
                    "agent_id": self.agent_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "context_patch": context_patch,
                }
            )
            self.cache.publish(f"agent_sync_{self.agent_id}", message)

            self.logger.debug(f"Updated working context for agent {self.agent_id}")

        except Exception as e:
            self.logger.error(f"Error updating context: {e}")
            raise

    async def append_to_context(self, key: str, value: Any):
        """
        Append a value to a specific context key (for array-type context).

        Args:
            key: Context key to append to
            value: Value to append
        """
        try:
            # Fetch current context
            persona = await self.fetch_persona()
            current_context = persona.get("context", {})

            # Initialize array if needed
            if key not in current_context:
                current_context[key] = []

            # Append value
            if not isinstance(current_context[key], list):
                current_context[key] = [current_context[key]]
            current_context[key].append(value)

            # Update
            await self.update_working_context(current_context)

        except Exception as e:
            self.logger.error(f"Error appending to context: {e}")
            raise

    async def get_context_value(self, key: str, default: Any = None) -> Any:
        """
        Get a specific value from working context.

        Args:
            key: Context key to retrieve
            default: Default value if key not found

        Returns:
            Context value or default
        """
        try:
            persona = await self.fetch_persona()
            context = persona.get("context", {})
            return context.get(key, default)

        except Exception as e:
            self.logger.error(f"Error getting context value: {e}")
            return default

    async def listen_for_updates(self, callback=None):
        """
        Listen for updates from other agents via Redis pub/sub.

        Args:
            callback: Optional async function to call on each message
        """
        try:
            for message in self.pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    self.logger.debug(f"Received sync update: {data}")

                    if callback:
                        await callback(data)

        except Exception as e:
            self.logger.error(f"Error in update listener: {e}")

    async def sync_with_peers(self, peer_agent_ids: List[str]):
        """
        Synchronize context with peer agents.

        Args:
            peer_agent_ids: List of agent IDs to sync with
        """
        try:
            my_persona = await self.fetch_persona()
            my_context = my_persona.get("context", {})

            for peer_id in peer_agent_ids:
                if peer_id != self.agent_id:
                    # Publish context to peer
                    message = json.dumps(
                        {
                            "agent_id": self.agent_id,
                            "timestamp": datetime.utcnow().isoformat(),
                            "full_context": my_context,
                            "sync_type": "full",
                        }
                    )
                    self.cache.publish(f"agent_sync_{peer_id}", message)

            self.logger.info(f"Synced with {len(peer_agent_ids)} peer agents")

        except Exception as e:
            self.logger.error(f"Error syncing with peers: {e}")
            raise

    async def checkpoint(self, checkpoint_name: str, data: Dict[str, Any] = None):
        """
        Create a named checkpoint of current state.

        Args:
            checkpoint_name: Identifier for this checkpoint
            data: Optional additional data to store
        """
        try:
            persona = await self.fetch_persona()
            checkpoint_data = {
                "agent_id": self.agent_id,
                "checkpoint_name": checkpoint_name,
                "timestamp": datetime.utcnow().isoformat(),
                "context": persona.get("context", {}),
                "goals": persona.get("goals", []),
                "additional_data": data or {},
            }

            # Store in checkpoints table
            self.client.table("soul_checkpoints").insert(checkpoint_data).execute()

            self.logger.info(f"Created checkpoint: {checkpoint_name}")

        except Exception as e:
            self.logger.error(f"Error creating checkpoint: {e}")
            raise

    async def restore_checkpoint(self, checkpoint_name: str) -> bool:
        """
        Restore agent state from a named checkpoint.

        Args:
            checkpoint_name: Checkpoint to restore

        Returns:
            True if restored successfully
        """
        try:
            response = (
                self.client.table("soul_checkpoints")
                .select("*")
                .eq("agent_id", self.agent_id)
                .eq("checkpoint_name", checkpoint_name)
                .order("timestamp", desc=True)
                .limit(1)
                .execute()
            )

            if not response.data:
                self.logger.warning(f"Checkpoint not found: {checkpoint_name}")
                return False

            checkpoint = response.data[0]

            # Restore context
            await self.update_working_context(checkpoint.get("context", {}))

            # Restore goals if different
            current_persona = await self.fetch_persona()
            if checkpoint.get("goals") != current_persona.get("goals"):
                self.client.table("soul_anchors").update(
                    {"goals": checkpoint.get("goals", [])}
                ).eq("id", self.agent_id).execute()

            self.logger.info(f"Restored checkpoint: {checkpoint_name}")
            return True

        except Exception as e:
            self.logger.error(f"Error restoring checkpoint: {e}")
            return False


class SoulAnchorHomeAssistantBridge:
    """
    Bridge between Soul Anchor and Home Assistant.

    Enables the Digital Person to:
    - Query Home Assistant state through Soul Anchor
    - Persist Home Assistant context across sessions
    - Synchronize automations with agent goals
    """

    def __init__(
        self, soul_anchor: SoulAnchor, ha_api_url: str = None, ha_token: str = None
    ):
        """
        Initialize Home Assistant bridge.

        Args:
            soul_anchor: SoulAnchor instance
            ha_api_url: Home Assistant API URL (or from env var)
            ha_token: Home Assistant long-lived token (or from env var)
        """
        self.soul = soul_anchor
        self.ha_url = ha_api_url or os.getenv(
            "HA_API_URL", "http://homeassistant.local:8123"
        )
        self.ha_token = ha_token or os.getenv("HA_TOKEN")
        self.logger = logging.getLogger(f"SoulAnchorHA-{soul_anchor.agent_id}")

    async def fetch_ha_context(self) -> Dict[str, Any]:
        """
        Fetch relevant Home Assistant state and persist to Soul Anchor.

        Returns:
            Dict containing HA context
        """
        import aiohttp

        headers = {
            "Authorization": f"Bearer {self.ha_token}",
            "Content-Type": "application/json",
        }

        try:
            async with aiohttp.ClientSession() as session:
                # Fetch states
                async with session.get(
                    f"{self.ha_url}/api/states", headers=headers
                ) as resp:
                    if resp.status == 200:
                        states = await resp.json()

                        # Filter for relevant entities
                        context = {
                            "ha_states": states,
                            "ha_last_sync": datetime.utcnow().isoformat(),
                            "ha_entity_count": len(states),
                        }

                        # Persist to Soul Anchor
                        await self.soul.update_working_context(
                            {"home_assistant": context}
                        )

                        self.logger.info(
                            f"Synced {len(states)} HA entities to Soul Anchor"
                        )
                        return context
                    else:
                        self.logger.error(f"HA API error: {resp.status}")
                        return {}

        except Exception as e:
            self.logger.error(f"Error fetching HA context: {e}")
            return {}

    async def execute_service(
        self, domain: str, service: str, service_data: Dict = None
    ):
        """
        Execute a Home Assistant service and record to Soul Anchor history.

        Args:
            domain: Service domain (e.g., 'light', 'switch')
            service: Service name (e.g., 'turn_on', 'turn_off')
            service_data: Optional service data
        """
        import aiohttp

        headers = {
            "Authorization": f"Bearer {self.ha_token}",
            "Content-Type": "application/json",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.ha_url}/api/services/{domain}/{service}",
                    headers=headers,
                    json=service_data or {},
                ) as resp:
                    if resp.status == 200:
                        # Record action to Soul Anchor
                        action_record = {
                            "timestamp": datetime.utcnow().isoformat(),
                            "domain": domain,
                            "service": service,
                            "data": service_data,
                            "result": "success",
                        }

                        await self.soul.append_to_context(
                            "ha_action_history", action_record
                        )
                        self.logger.info(f"Executed HA service: {domain}.{service}")
                        return True
                    else:
                        self.logger.error(f"HA service error: {resp.status}")
                        return False

        except Exception as e:
            self.logger.error(f"Error executing HA service: {e}")
            return False


# Example usage and test
if __name__ == "__main__":
    import asyncio

    async def test_soul_anchor():
        """Test Soul Anchor functionality."""
        # Initialize
        anchor = SoulAnchor(
            agent_id="test-agent-001",
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_KEY"),
            redis_host="localhost",
        )

        # Fetch persona
        persona = await anchor.fetch_persona()
        print(f"Fetched persona: {persona.get('name', 'Unknown')}")

        # Update context
        await anchor.update_working_context(
            {
                "last_interaction": datetime.utcnow().isoformat(),
                "current_location": "test_environment",
            }
        )

        # Create checkpoint
        await anchor.checkpoint("test_checkpoint", {"test_data": "value"})

        print("Soul Anchor test completed successfully")

    # Run test
    asyncio.run(test_soul_anchor())
