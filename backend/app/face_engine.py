"""
IBVAP - Tactical Facial Identification Engine
Combines YuNet Face Detector (ONNX) with SFace Face Recognizer (OpenCV Zoo ONNX).
Computes 128-d L2-normalized embeddings and evaluates against pre-cached reference photos
in backend/watchlist/ using Cosine Similarity.

ETHICAL & LEGAL COMPLIANCE DISCLAIMER:
This identification engine operates exclusively against a small, local, consented demo
watchlist (e.g., team members) for proof-of-concept testing. It is NOT connected to any
government, law-enforcement, or public biometric identity database.
"""

from pathlib import Path
from typing import Any, Optional, Tuple
import cv2
import numpy as np

try:
    from backend.app.admin_management import check_watchlist_person_active
except ImportError:
    try:
        from admin_management import check_watchlist_person_active
    except ImportError:
        check_watchlist_person_active = lambda name, db_path=None: True


def enhance_face_illumination(crop: np.ndarray) -> np.ndarray:
    """
    Adaptive Face Illumination Normalization (AFIN) for Night / Low-Light & Backlit Scenes:
    - Preserves sharp facial edges (eyes, nose contour, lips) using bilateral filtering instead of blur
    - Expands dark shadow details adaptively based on ambient darkness (gamma correction)
    - Applies localized CLAHE in LAB space with conservative grid sizes (4, 4) to prevent noise amplification
    """
    if crop is None or crop.size == 0:
        return crop

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    mean_luma = float(np.mean(gray))
    if mean_luma >= 140.0:
        return crop

    # 1. Edge-preserving bilateral filter to remove sensor noise without smearing facial features
    denoised = cv2.bilateralFilter(crop, d=5, sigmaColor=35, sigmaSpace=35)

    # 2. Adaptive Gamma expansion for low-light & backlit shadows
    gamma = float(np.clip(0.38 + 0.60 * (mean_luma / 140.0), 0.35, 0.92))
    lut = np.array([((i / 255.0) ** gamma) * 255 for i in range(256)]).astype(np.uint8)
    gamma_corrected = cv2.LUT(denoised, lut)

    # 3. Dynamic multi-grid CLAHE in LAB color space
    lab = cv2.cvtColor(gamma_corrected, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clip_limit = float(np.clip(2.0 + 1.8 * (1.0 - mean_luma / 140.0), 1.8, 4.0))
    grid_sz = (4, 4) if min(crop.shape[:2]) < 80 else (6, 6)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=grid_sz)
    l_clahe = clahe.apply(l)

    # 4. Reconstruct BGR
    merged = cv2.merge((l_clahe, a, b))
    enhanced = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    return enhanced


class WatchlistFaceRecognizer:
    """
    Consented Demo Watchlist Face Identification Subsystem.
    Combines YuNet Face Detector (ONNX) with SFace Face Recognizer (OpenCV Zoo ONNX).
    Computes 128-d L2-normalized embeddings and evaluates against pre-cached reference photos
    in backend/watchlist/ using Cosine Similarity.
    """

    def __init__(
        self,
        watchlist_dir: Optional[Path] = None,
        models_dir: Optional[Path] = None,
        cosine_threshold: float = 0.38,
    ):
        self.cosine_threshold = cosine_threshold
        if watchlist_dir is None:
            watchlist_dir = Path(__file__).resolve().parent.parent / "watchlist"
        if models_dir is None:
            models_dir = Path(__file__).resolve().parent.parent / "models"

        self.watchlist_dir = watchlist_dir
        self.models_dir = models_dir
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.watchlist_dir.mkdir(parents=True, exist_ok=True)

        self.detector = self._init_detector()
        self.recognizer = self._init_recognizer()
        self.watchlist_embeddings: dict[str, np.ndarray] = {}
        self.reload_watchlist()

    def _init_detector(self) -> Optional[Any]:
        try:
            if not hasattr(cv2, "FaceDetectorYN"):
                return None
            yunet_path = self.models_dir / "face_detection_yunet_2023mar.onnx"
            if not yunet_path.exists() or yunet_path.stat().st_size < 10000:
                url = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
                import urllib.request
                urllib.request.urlretrieve(url, yunet_path)
            return cv2.FaceDetectorYN.create(
                str(yunet_path),
                "",
                (320, 320),
                score_threshold=0.32,
                nms_threshold=0.3,
                top_k=5000,
            )
        except Exception:
            return None

    def _init_recognizer(self) -> Optional[Any]:
        try:
            if not hasattr(cv2, "FaceRecognizerSF"):
                return None
            sface_path = self.models_dir / "face_recognition_sface_2021dec.onnx"
            if not sface_path.exists() or sface_path.stat().st_size < 10000:
                url = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
                import urllib.request
                urllib.request.urlretrieve(url, sface_path)
            return cv2.FaceRecognizerSF.create(str(sface_path), "")
        except Exception:
            return None

    def reload_watchlist(self):
        """Scans backend/watchlist/ and extracts 128-d SFace embeddings for all reference images."""
        # Ensure any cloud-stored photos from Cloudinary CDN are synced to local disk first
        try:
            from backend.app.admin_management import sync_cloud_watchlist_to_disk
            sync_cloud_watchlist_to_disk(watchlist_dir=self.watchlist_dir)
        except Exception:
            try:
                from admin_management import sync_cloud_watchlist_to_disk
                sync_cloud_watchlist_to_disk(watchlist_dir=self.watchlist_dir)
            except Exception:
                pass

        self.watchlist_embeddings.clear()
        if not self.detector or not self.recognizer:
            return

        valid_exts = [".jpg", ".jpeg", ".png", ".webp"]
        for p in sorted(self.watchlist_dir.iterdir()):
            if p.suffix.lower() in valid_exts:
                if p.stem.lower().startswith(("default", "placeholder", "avatar")):
                    continue
                name = p.stem.replace("_", " ").strip().title()
                img = cv2.imread(str(p))
                if img is None:
                    continue
                ih, iw = img.shape[:2]
                self.detector.setInputSize((iw, ih))
                _, faces = self.detector.detect(img)
                if faces is not None and len(faces) > 0:
                    best_face = max(faces, key=lambda f: f[14])
                    if best_face[14] >= 0.40:
                        aligned = self.recognizer.alignCrop(img, best_face)
                        feat = self.recognizer.feature(aligned)
                        self.watchlist_embeddings[name] = feat

    def identify_face_in_person_crop(
        self, frame: np.ndarray, person_bbox: Tuple[int, int, int, int]
    ) -> Tuple[Optional[str], float, Optional[list[float]]]:
        """
        Detect face in person crop, validate geometry & landmarks, extract 128-d embedding,
        and match against watchlist with ambiguity margin check.
        Returns (identified_as, match_confidence, face_bbox_coords).
        - Matched watchlist identity: ("Alex Team Lead", 0.84, [fx1, fy1, fx2, fy2])
        - Face detected but unlisted: ("UNKNOWN", 0.18, [fx1, fy1, fx2, fy2])
        - No face detected in crop : (None, 0.0, None)
        """
        if self.detector is None:
            return None, 0.0, None

        h, w = frame.shape[:2]
        x1, y1, x2, y2 = map(int, person_bbox)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        person_h = y2 - y1
        person_w = x2 - x1
        if person_h < 35 or person_w < 18:
            return None, 0.0, None

        # Extract head region (upper 70% of person bounding box)
        head_y2 = y1 + int(person_h * 0.70)
        crop = frame[y1:head_y2, x1:x2]
        ch, cw = crop.shape[:2]
        if ch < 20 or cw < 20:
            return None, 0.0, None

        gray_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        crop_mean_luma = float(np.mean(gray_crop))
        is_low_light = (crop_mean_luma < 95.0)

        # Apply Adaptive Face Illumination Normalization (AFIN) for low-light & shadows
        crop_enh = enhance_face_illumination(crop)

        try:
            self.detector.setInputSize((cw, ch))
            _, faces = self.detector.detect(crop_enh)
            if faces is None or len(faces) == 0:
                # Fallback to raw crop if enhanced crop yielded no detections
                _, faces = self.detector.detect(crop)
                if faces is None or len(faces) == 0:
                    return None, 0.0, None
                crop_to_use = crop
            else:
                crop_to_use = crop_enh

            best_face = max(faces, key=lambda f: f[14])
            det_score = float(best_face[14])
            if det_score < 0.28:
                return None, 0.0, None

            fx, fy, fw, fh = float(best_face[0]), float(best_face[1]), float(best_face[2]), float(best_face[3])
            if fw < 18.0 or fh < 18.0:
                return None, 0.0, None

            # Check facial aspect ratio to eliminate false profile/background patches
            aspect_ratio = fw / max(1.0, fh)
            if aspect_ratio < 0.45 or aspect_ratio > 1.75:
                return None, 0.0, None

            # Verify facial landmark distance (eyes must be distinctly separated)
            x_re, y_re = float(best_face[4]), float(best_face[5])
            x_le, y_le = float(best_face[6]), float(best_face[7])
            eye_dist = ((x_le - x_re) ** 2 + (y_le - y_re) ** 2) ** 0.5
            if eye_dist < 6.0:
                return None, 0.0, None

            abs_fx1 = round(float(x1 + max(0, fx)), 1)
            abs_fy1 = round(float(y1 + max(0, fy)), 1)
            abs_fx2 = round(float(x1 + min(cw, fx + fw)), 1)
            abs_fy2 = round(float(y1 + min(ch, fy + fh)), 1)
            face_coords = [abs_fx1, abs_fy1, abs_fx2, abs_fy2]

            if not self.recognizer or not self.watchlist_embeddings:
                return "UNKNOWN", 0.0, face_coords

            # Dual-embedding extraction in low-light / night conditions:
            # Evaluate both illumination-normalized and raw crops against reference photos
            aligned_enh = self.recognizer.alignCrop(crop_enh, best_face)
            feat_enh = self.recognizer.feature(aligned_enh)

            feat_raw = None
            if is_low_light:
                try:
                    aligned_raw = self.recognizer.alignCrop(crop, best_face)
                    feat_raw = self.recognizer.feature(aligned_raw)
                except Exception:
                    feat_raw = None

            # Compute similarities against all registered watchlist identities
            scores = []
            for name, ref_feat in self.watchlist_embeddings.items():
                sim_enh = float(self.recognizer.match(feat_enh, ref_feat, cv2.FaceRecognizerSF_FR_COSINE))
                if feat_raw is not None:
                    sim_raw = float(self.recognizer.match(feat_raw, ref_feat, cv2.FaceRecognizerSF_FR_COSINE))
                    sim = max(sim_enh, sim_raw)
                else:
                    sim = sim_enh
                scores.append((sim, name))

            scores.sort(key=lambda s: s[0], reverse=True)
            best_sim, best_candidate = scores[0]
            second_sim = scores[1][0] if len(scores) > 1 else 0.0

            # Adaptive dynamic thresholding based on ambient illumination & face size
            if is_low_light:
                base_thresh = 0.34
            elif crop_mean_luma < 120.0:
                base_thresh = 0.36
            else:
                base_thresh = self.cosine_threshold

            required_thresh = base_thresh
            if fw < 20.0 or fh < 20.0:
                required_thresh = max(required_thresh, base_thresh + 0.02)

            # Separation Margin: confirmed match if clear lead over 2nd profile or high single score
            margin = best_sim - second_sim
            is_confident_match = (best_sim >= required_thresh) and (
                margin >= 0.025 or best_sim >= 0.45 or len(scores) <= 1
            )

            if is_confident_match:
                best_name = best_candidate
            else:
                best_name = "UNKNOWN"

            # Enforce expiration check: skip matching if identity has expired
            if best_name != "UNKNOWN":
                if not check_watchlist_person_active(best_name):
                    print(f"[!] Expired watchlist profile skipped during live detection: '{best_name}'")
                    best_name = "UNKNOWN"
                    best_sim = 0.0

            return best_name, round(best_sim, 3), face_coords
        except Exception:
            return None, 0.0, None


_global_watchlist_recognizer: Optional[WatchlistFaceRecognizer] = None


def get_watchlist_recognizer(reload: bool = False) -> Optional[WatchlistFaceRecognizer]:
    """Retrieve shared WatchlistFaceRecognizer instance with on-demand reload support."""
    global _global_watchlist_recognizer
    backend_dir = Path(__file__).resolve().parent.parent
    if _global_watchlist_recognizer is None:
        try:
            _global_watchlist_recognizer = WatchlistFaceRecognizer(
                watchlist_dir=backend_dir / "watchlist",
                models_dir=backend_dir / "models",
                cosine_threshold=0.38,
            )
        except Exception:
            pass
    elif reload:
        try:
            _global_watchlist_recognizer.reload_watchlist()
        except Exception:
            pass
    return _global_watchlist_recognizer
