import cloudinary
import cloudinary.uploader
from flask import current_app


def _configure_cloudinary():
	cloud_name = current_app.config.get("CLOUDINARY_CLOUD_NAME")
	api_key = current_app.config.get("CLOUDINARY_API_KEY")
	api_secret = current_app.config.get("CLOUDINARY_API_SECRET")

	if not cloud_name or not api_key or not api_secret:
		raise RuntimeError("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET")

	cloudinary.config(
		cloud_name=cloud_name,
		api_key=api_key,
		api_secret=api_secret,
		secure=True,
	)


def upload_product_image(file_storage, folder="ecommerce/products"):
	if file_storage is None:
		raise ValueError("Image file is required")

	_configure_cloudinary()

	result = cloudinary.uploader.upload(file_storage, folder=folder, resource_type="image")
	image_url = result.get("secure_url") or result.get("url")
	if not image_url:
		raise RuntimeError("Cloudinary upload failed")
	return image_url
