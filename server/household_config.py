"""
Backend Configuration for Household Expense Tracker
Customize these settings for your household
"""

# Household Configuration
HOUSEHOLD_CONFIG = {
    # Default household members
    'default_members': ['Member 1', 'Member 2', 'Other'],
    
    # Default spender when none is specified
    'default_spender': 'Member 1',
    
    # Database configuration
    'db_path': './client_expense_tracker.db',
    
    # Application settings
    'app_title': 'Household Expense Tracker',
    'currency': 'USD'
}

def setup_household(member1_name, member2_name):
    """
    Configure the app for your household members
    
    Args:
        member1_name (str): Name of first household member
        member2_name (str): Name of second household member
    """
    HOUSEHOLD_CONFIG['default_members'] = [member1_name, member2_name, 'Other']
    HOUSEHOLD_CONFIG['default_spender'] = member1_name

def add_household_member(member_name):
    """
    Add an additional household member
    
    Args:
        member_name (str): Name of the new household member
    """
    if member_name not in HOUSEHOLD_CONFIG['default_members']:
        # Insert before 'Other'
        members = HOUSEHOLD_CONFIG['default_members']
        if 'Other' in members:
            other_index = members.index('Other')
            members.insert(other_index, member_name)
        else:
            members.append(member_name)

# Example usage:
# To set up for a couple:
# setup_household('John', 'Jane')
#
# To set up for roommates:
# setup_household('Alex', 'Sam')
#
# To add a third member:
# add_household_member('Kids')
