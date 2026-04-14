def _join_lines(lines):
    return "\n".join(lines)


def collection_doc(tag, title, search_fields):
    search_hint = ", ".join(search_fields) if search_fields else "id"
    return _join_lines([
        f"{title} list",
        "---",
        "tags:",
        f"  - {tag}",
        "parameters:",
        "  - in: query",
        "    name: q",
        "    schema:",
        "      type: string",
        f"    description: \"Search by {search_hint}\"",
        "  - in: query",
        "    name: page",
        "    schema:",
        "      type: integer",
        "      default: 1",
        "  - in: query",
        "    name: per_page",
        "    schema:",
        "      type: integer",
        "      default: 10",
        "responses:",
        "  200:",
        "    description: Paginated list",
    ])


def item_doc(tag, title):
    return _join_lines([
        f"{title} detail",
        "---",
        "tags:",
        f"  - {tag}",
        "parameters:",
        "  - in: path",
        "    name: item_id",
        "    required: true",
        "    schema:",
        "      type: integer",
        "responses:",
        "  200:",
        "    description: Item detail",
        "  404:",
        "    description: Not found",
    ])


def create_doc(tag, title, required_fields):
    fields_text = ", ".join(required_fields) if required_fields else "none"
    return _join_lines([
        f"Create {title.lower()}",
        "---",
        "tags:",
        f"  - {tag}",
        "parameters:",
        "  - in: body",
        "    name: body",
        "    required: true",
        "    schema:",
        "      type: object",
        f"      description: \"Required fields: {fields_text}\"",
        "responses:",
        "  201:",
        "    description: Created",
        "  400:",
        "    description: Validation or integrity error",
    ])


def update_doc(tag, title, required_fields):
    fields_text = ", ".join(required_fields) if required_fields else "none"
    return _join_lines([
        f"Update {title.lower()}",
        "---",
        "tags:",
        f"  - {tag}",
        "parameters:",
        "  - in: path",
        "    name: item_id",
        "    required: true",
        "    schema:",
        "      type: integer",
        "  - in: body",
        "    name: body",
        "    required: true",
        "    schema:",
        "      type: object",
        f"      description: \"Updatable fields: {fields_text}\"",
        "responses:",
        "  200:",
        "    description: Updated",
        "  404:",
        "    description: Not found",
        "  400:",
        "    description: Validation or integrity error",
    ])


def delete_doc(tag, title):
    return _join_lines([
        f"Delete {title.lower()}",
        "---",
        "tags:",
        f"  - {tag}",
        "parameters:",
        "  - in: path",
        "    name: item_id",
        "    required: true",
        "    schema:",
        "      type: integer",
        "responses:",
        "  200:",
        "    description: Deleted",
        "  404:",
        "    description: Not found",
    ])


def auth_doc(tag, title, fields):
    fields_text = ", ".join(fields)
    return _join_lines([
        title,
        "---",
        "tags:",
        f"  - {tag}",
        "parameters:",
        "  - in: body",
        "    name: body",
        "    required: true",
        "    schema:",
        "      type: object",
        f"      description: \"Required fields: {fields_text}\"",
        "responses:",
        "  200:",
        "    description: Success",
        "  201:",
        "    description: Created",
        "  400:",
        "    description: Validation error",
        "  401:",
        "    description: Unauthorized",
    ])


def foreign_key_doc(tag, title, foreign_label):
    return _join_lines([
        f"List {title.lower()} by {foreign_label}",
        "---",
        "tags:",
        f"  - {tag}",
        "parameters:",
        "  - in: path",
        f"    name: {foreign_label}",
        "    required: true",
        "    schema:",
        "      type: integer",
        "responses:",
        "  200:",
        "    description: Filtered list",
        "  404:",
        "    description: Not found",
    ])