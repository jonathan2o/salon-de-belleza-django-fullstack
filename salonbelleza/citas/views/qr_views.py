from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from citas.services.qr_service import QRService


class ObtenerQRView(APIView):
    def get(self, request, cita_id=None):
        origen = request.META.get("HTTP_ORIGIN", "https://salonestilo.shop")
        datos_qr = QRService.obtener_o_generar_qr(origen)
        
        # Enriquecer respuesta para máxima compatibilidad con frontend
        respuesta = {
            "url_destino": datos_qr.get("url_destino"),
            "imagen_base64": datos_qr.get("imagen_base64"),
            "qr_code": datos_qr.get("imagen_base64"),
            "qr_image": datos_qr.get("imagen_base64"),
            "cita_id": cita_id,
        }
        return Response(respuesta, status=status.HTTP_200_OK)
