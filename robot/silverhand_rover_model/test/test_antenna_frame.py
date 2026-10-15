"""Geometry checks with synthetic placement; not physical calibration data."""
import shutil
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
import xacro
import yaml


class AntennaFrameTest(unittest.TestCase):
    def test_shared_geometry_and_arm_mount(self):
        source = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(source / 'urdf', root / 'urdf')
            shutil.copytree(source / 'config', root / 'config')
            config = root / 'config/antenna_frame.yaml'
            values = yaml.safe_load(config.read_text())
            values.update(enabled=True, mount_x=-0.2, antenna_radius=0.015)
            config.write_text(yaml.safe_dump(values))

            def expand(parent, offset_x, offset_z):
                document = xacro.parse(f'''<robot xmlns:xacro="http://www.ros.org/wiki/xacro" name="test">
                  <xacro:include filename="{root}/urdf/antenna_frame_mount.urdf.xacro"/>
                  <xacro:rukahod_configured_antenna_frame parent="{parent}" offset_x="{offset_x}" offset_z="{offset_z}"/>
                </robot>''')
                xacro.process_doc(document)
                return ET.fromstring(document.toxml())

            rover = expand('base_link', 0, 0)
            arm = expand('arm_base_link', -0.324, 0.076)
            self.assertEqual(len(rover.findall('link')), 6)
            solids = [link for link in rover.findall('link') if link.find('collision') is not None]
            self.assertEqual(len(solids), 5)
            for link in solids:
                self.assertEqual(ET.tostring(link.find('collision/geometry')), ET.tostring(link.find('visual/geometry')))
            rv = [float(v) for v in rover.find("joint[@name='antenna_frame_mount_fixed']/origin").get('xyz').split()]
            av = [float(v) for v in arm.find("joint[@name='antenna_frame_mount_fixed']/origin").get('xyz').split()]
            self.assertAlmostEqual(rv[0] - av[0], 0.324)
            self.assertAlmostEqual(av[2] - rv[2], 0.076)
            antenna = rover.find("link[@name='antenna_frame_left_antenna']/collision")
            center = float(antenna.find('origin').get('xyz').split()[2])
            length = float(antenna.find('geometry/cylinder').get('length'))
            self.assertAlmostEqual(center + length / 2, 0.38 + 0.30 - 0.05)
            values['enabled'] = False
            config.write_text(yaml.safe_dump(values))
            self.assertEqual(len(expand('base_link', 0, 0)), 0)


if __name__ == '__main__':
    unittest.main()
