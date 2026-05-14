from setuptools import setup, find_packages

with open('README.md', 'w') as f:
    f.write('# MapleSpike Python SDK\n\nPython SDK for the MapleSpike civilian intelligence API.\n')

setup(
    name='maplespike',
    version='0.1.0',
    description='MapleSpike Python SDK — typed client for the MapleSpike civilian intelligence API',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    author='MapleSpike',
    author_email='dev@maplespike.ca',
    url='https://github.com/maplespike/sdk-python',
    packages=find_packages(),
    include_package_data=True,
    python_requires='>=3.8',
    install_requires=[],
    extras_require={
        'dev': [
            'pytest>=7.0',
            'pytest-cov>=4.0',
        ],
    },
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
        'Operating System :: OS Independent',
    ],
    keywords='maplespike api sdk canada government intelligence data',
    project_urls={
        'Source': 'https://github.com/maplespike/sdk-python',
        'Tracker': 'https://github.com/maplespike/sdk-python/issues',
    },
)
