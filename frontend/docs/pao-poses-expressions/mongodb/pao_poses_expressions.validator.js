// Paste into Compass > pao_poses_expressions > Validation (validationLevel: moderate).
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": [
      "key",
      "type",
      "name",
      "asset_key",
      "preview_image_url",
      "sort_order",
      "is_free",
      "is_default",
      "is_active",
      "is_archived",
      "created_at",
      "updated_at"
    ],
    "properties": {
      "key": {
        "bsonType": "string",
        "minLength": 1,
        "pattern": "^[a-z][a-z0-9_]*$",
        "maxLength": 32
      },
      "type": {
        "enum": [
          "pose",
          "expression"
        ]
      },
      "name": {
        "bsonType": "string",
        "minLength": 1,
        "maxLength": 60
      },
      "description": {
        "bsonType": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "asset_key": {
        "bsonType": "string",
        "minLength": 1,
        "pattern": "^[a-z][a-z0-9_]*$",
        "maxLength": 64
      },
      "preview_image_url": {
        "bsonType": "string",
        "minLength": 1,
        "maxLength": 500
      },
      "sort_order": {
        "bsonType": "int",
        "minimum": 0
      },
      "is_free": {
        "bsonType": "bool"
      },
      "is_default": {
        "bsonType": "bool"
      },
      "is_active": {
        "bsonType": "bool"
      },
      "is_archived": {
        "bsonType": "bool"
      },
      "archived_at": {
        "bsonType": "date"
      },
      "created_by": {
        "bsonType": "string",
        "minLength": 1
      },
      "updated_by": {
        "bsonType": "string",
        "minLength": 1
      },
      "created_at": {
        "bsonType": "date"
      },
      "updated_at": {
        "bsonType": "date"
      }
    }
  }
}
