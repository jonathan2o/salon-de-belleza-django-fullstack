import base64
from io import BytesIO
import qrcode
from citas.models import CodigoQR


class QRService:

    @staticmethod
    def obtener_o_generar_qr(origin_header: str | None = None) -> dict:
        qr_obj = CodigoQR.objects.first()
        if qr_obj:
            return {
                "url_destino": qr_obj.url_destino,
                "imagen_base64": qr_obj.imagen_base64,
            }

        origen = origin_header or "https://salonestilo.shop"
        url_destino = f"{origen}/citas"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(url_destino)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffer = BytesIO()
        img.save(buffer)
        img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")

        nuevo_qr = CodigoQR.objects.create(
            url_destino=url_destino, imagen_base64=img_str
        )

        return {
            "url_destino": nuevo_qr.url_destino,
            "imagen_base64": nuevo_qr.imagen_base64,
        }
