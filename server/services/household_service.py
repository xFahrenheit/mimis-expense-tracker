import json
from .database_service import get_db_connection

def get_household_config():
    """Get the current household configuration"""
    try:
        with get_db_connection() as conn:
            cursor = conn.execute('SELECT config_json FROM household_config WHERE id = 1')
            result = cursor.fetchone()
            
            if result:
                return json.loads(result[0])
            else:
                # Return default configuration
                return {
                    "members": [
                        {"name": "Member 1", "emoji": "👤", "color": "#6cbda0", "userKey": "member1"},
                        {"name": "Member 2", "emoji": "👤", "color": "#f4acb7", "userKey": "member2"}
                    ],
                    "defaultSpender": "Member 1",
                    "appTitle": "Household Expense Tracker"
                }
    except Exception as e:
        print(f"Error getting household config: {e}")
        # Return default configuration on error
        return {
            "members": [
                {"name": "Member 1", "emoji": "👤", "color": "#6cbda0", "userKey": "member1"},
                {"name": "Member 2", "emoji": "👤", "color": "#f4acb7", "userKey": "member2"}
            ],
            "defaultSpender": "Member 1",
            "appTitle": "Household Expense Tracker"
        }

def save_household_config(config):
    """Save the household configuration"""
    try:
        with get_db_connection() as conn:
            config_json = json.dumps(config)
            # Use INSERT OR REPLACE to handle both insert and update
            conn.execute('''
                INSERT OR REPLACE INTO household_config (id, config_json) 
                VALUES (1, ?)
            ''', (config_json,))
            conn.commit()
            return True
    except Exception as e:
        print(f"Error saving household config: {e}")
        return False

def add_household_member(name, emoji="👤", color="#6cbda0"):
    """Add a new household member"""
    try:
        config = get_household_config()
        
        # Generate a unique userKey
        existing_keys = [member.get("userKey", "") for member in config["members"]]
        user_key = f"member{len(config['members']) + 1}"
        while user_key in existing_keys:
            user_key = f"member{len(config['members']) + len(existing_keys) + 1}"
        
        new_member = {
            "name": name,
            "emoji": emoji,
            "color": color,
            "userKey": user_key
        }
        
        config["members"].append(new_member)
        
        if save_household_config(config):
            return new_member
        else:
            return None
    except Exception as e:
        print(f"Error adding household member: {e}")
        return None

def remove_household_member(member_name):
    """Remove a household member"""
    try:
        config = get_household_config()
        
        # Filter out the member to remove
        original_count = len(config["members"])
        config["members"] = [member for member in config["members"] if member["name"] != member_name]
        
        # Check if we actually removed someone
        if len(config["members"]) < original_count:
            # If we removed the default spender, set to first remaining member
            if config.get("defaultSpender") == member_name and config["members"]:
                config["defaultSpender"] = config["members"][0]["name"]
            
            return save_household_config(config)
        else:
            return False  # Member not found
    except Exception as e:
        print(f"Error removing household member: {e}")
        return False

def update_default_spender(spender_name):
    """Update the default spender"""
    try:
        config = get_household_config()
        
        # Verify the spender exists
        member_names = [member["name"] for member in config["members"]]
        if spender_name in member_names:
            config["defaultSpender"] = spender_name
            return save_household_config(config)
        else:
            return False  # Spender not found
    except Exception as e:
        print(f"Error updating default spender: {e}")
        return False
